package handlers

import (
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"vino/backend/internal/config"
	"vino/backend/internal/db"
	"vino/backend/internal/dbbackup"
	"vino/backend/internal/dbgate"
	"vino/backend/internal/resp"
	"vino/backend/internal/services"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql" // 注册 database/sql 的 mysql 驱动（gorm 也间接依赖）
)

var (
	dbNameIdent = regexp.MustCompile(`^[A-Za-z0-9_]{1,64}$`)
	// mysqldump 在 MySQL 8 里会输出：`CREATE DATABASE /*!32312 IF NOT EXISTS*/ `vino_db` /*!40100 ... */;`
	// 因此正则里要能跳过任意 `/*!... */` 版本化注释块，否则抓不到库名，导致后续 rewrite 失效、
	// 整份 dump 被原样注入、`USE ` 把建表/灌数切到了源主库（restore_* 壳库因而 0 张表）。
	createDatabaseNameRe = regexp.MustCompile("(?is)CREATE\\s+DATABASE(?:\\s+/\\*![^*]+\\*/)*(?:\\s+IF\\s+NOT\\s+EXISTS)?(?:\\s+/\\*![^*]+\\*/)*\\s+`([^`]+)`")
	createDatabaseBareRe = regexp.MustCompile(`(?is)CREATE\s+DATABASE(?:\s+/\*![^*]+\*/)*(?:\s+IF\s+NOT\s+EXISTS)?(?:\s+/\*![^*]+\*/)*\s+([A-Za-z0-9_]+)\s*(?:;|/\*|$)`)
	// 用于「在导入前彻底删除 dump 里的 CREATE DATABASE / USE 语句」，最稳妥：
	// 我们已在 importToDatabase 里预建新库并通过 `mysql -D newDb` 提供默认上下文，
	// 不需要 dump 自带的建库/切库；留着反而会在解析失败时把数据落到错的库。
	stripCreateDatabaseRe = regexp.MustCompile(`(?im)^\s*CREATE\s+DATABASE\b[^;]*;\s*\r?\n?`)
	stripUseRe            = regexp.MustCompile(`(?im)^\s*USE\s+[^;]*;\s*\r?\n?`)
)

// 上海时区（用于生成 restore_YYYY_MM_DD_HH 与示例 URL）
var shanghaiLoc = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}()

type dbRestoreBody struct {
	URL string `json:"url"`
}

type dbSwitchBody struct {
	Database string `json:"database"`
}

type previewTable struct {
	Table   string     `json:"table"`
	Columns []string   `json:"columns"`
	Rows    [][]string `json:"rows"` // 每格 base64 编码后的字符串
	Note    string     `json:"note,omitempty"`
}

// GET /api/admin/ops/db/status
func adminGetDbStatus(c *gin.Context, cfg *config.Config) {
	now := time.Now().In(shanghaiLoc)
	base := services.CosBase()
	// 方案 A：路径按主库名分目录。示例优先用当前主库名（`cfg.DB.Name`），便于直接复制使用。
	examples := []string{
		fmt.Sprintf("%s/db_save/%s/%s/%s.sql.gz", base, cfg.DB.Name, now.Format("2006-01"), now.Format("02")),
	}
	resp.OK(c, gin.H{
		"database":           cfg.DB.Name,
		"host":               cfg.DB.Host,
		"port":               cfg.DB.Port,
		"activeNameFile":     cfg.DBActiveNameFile,
		"cosBucket":          services.CosBucket(),
		"cosBaseUrl":         base,
		"restoreMaxBytes":    cfg.DBRestoreMaxBytes,
		"restoreUrlExamples": examples,
		"restorePathNote":    "当前对象键规则：db_save/{主库名}/YYYY-MM/DD.sql.gz（管理端按钮与宿主机 cron 统一）。填写完整 HTTPS URL，path 须以 /db_save/{主库名}/ 开头。",
	})
}

// GET /api/admin/ops/db/databases — 列出当前 MySQL 实例中的用户库
func adminGetDbDatabases(c *gin.Context, cfg *config.Config) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	names, err := listUserDatabases(ctx, cfg)
	if err != nil {
		resp.Err(c, 500, 500, "列出数据库失败: "+err.Error())
		return
	}
	resp.OK(c, gin.H{"list": names, "current": cfg.DB.Name})
}

// POST /api/admin/ops/db/restore {url} — 下载 → 解压 → 重写库名 → 导入到新库 → 预览全表前 10 行
func adminPostDbRestore(c *gin.Context, cfg *config.Config) {
	if !cfg.COSConfigured() {
		resp.Err(c, 503, 503, "COS 未配置，无法下载备份")
		return
	}
	var body dbRestoreBody
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "JSON 无效")
		return
	}
	u, err := validateRestoreURL(strings.TrimSpace(body.URL))
	if err != nil {
		resp.Err(c, 400, 400, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Minute)
	defer cancel()

	var newDatabase string
	var preview []previewTable
	werr := dbgate.WithWrite(func() error {
		key := strings.TrimPrefix(u.Path, "/")
		data, derr := downloadBackup(ctx, u, key, cfg.DBRestoreMaxBytes)
		if derr != nil {
			return fmt.Errorf("下载备份: %w", derr)
		}
		sqlText, uerr := gunzipAll(data, cfg.DBRestoreMaxBytes*8)
		if uerr != nil {
			return fmt.Errorf("gzip 解压: %w", uerr)
		}
		base := fmt.Sprintf("restore_%s", time.Now().In(shanghaiLoc).Format("2006_01_02_15"))
		name, perr := pickUnusedRestoreDBName(ctx, cfg, base)
		if perr != nil {
			return perr
		}
		// 先尝试把 dump 里的库名替换成新库名，
		// 再彻底剥离 `CREATE DATABASE ...;` 和 `USE \`xxx\`;` 两种顶层语句。
		// 我们已在 importToDatabase 中预建目标库并用 `mysql -D newDb` 指定默认库，
		// 一旦 dump 里的 USE 语句未被正确改写，就会把 CREATE TABLE/INSERT 落回**原主库**，
		// restore_* 壳库反而保持空——这是 2026-04-20 版本确诊的真实事故。
		oldName := extractDumpDBName(sqlText, "")
		sqlRewrite := rewriteDumpDBName(sqlText, oldName, name)
		sqlSafe := stripCreateDatabaseAndUse(sqlRewrite)
		if ierr := importToDatabase(ctx, cfg, name, sqlSafe); ierr != nil {
			return fmt.Errorf("导入到 %s 失败: %w", name, ierr)
		}
		newDatabase = name
		preview = previewAllTables(ctx, cfg, name)
		return nil
	})
	if werr != nil {
		if ctx.Err() != nil {
			resp.Err(c, 408, 408, "恢复超时或已取消: "+werr.Error())
			return
		}
		resp.Err(c, 500, 500, werr.Error())
		return
	}
	resp.OK(c, gin.H{
		"newDatabase": newDatabase,
		"preview":     preview,
	})
}

// POST /api/admin/ops/db/switch {database} — 校验存在 → 写 active_db 文件 → Reopen
func adminPostDbSwitch(c *gin.Context, cfg *config.Config) {
	var body dbSwitchBody
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "JSON 无效")
		return
	}
	name := strings.TrimSpace(body.Database)
	if !dbNameIdent.MatchString(name) {
		resp.Err(c, 400, 400, "database 须为非空字母数字下划线标识（≤64 字符）")
		return
	}
	werr := dbgate.WithWrite(func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		ok, err := mysqlDatabaseExists(ctx, cfg, name)
		if err != nil {
			return err
		}
		if !ok {
			return fmt.Errorf("数据库不存在: %s", name)
		}
		if cfg.DBActiveNameFile != "" {
			if err := os.MkdirAll(filepath.Dir(cfg.DBActiveNameFile), 0o755); err != nil {
				return fmt.Errorf("创建 state 目录: %w", err)
			}
			if err := os.WriteFile(cfg.DBActiveNameFile, []byte(name+"\n"), 0o600); err != nil {
				return fmt.Errorf("写入 active_db 文件: %w", err)
			}
		}
		cfg.DB.Name = name
		if err := db.Reopen(cfg); err != nil {
			return fmt.Errorf("重连数据库: %w", err)
		}
		return nil
	})
	if werr != nil {
		resp.Err(c, 500, 500, werr.Error())
		return
	}
	resp.OK(c, gin.H{
		"database":       cfg.DB.Name,
		"activeNameFile": cfg.DBActiveNameFile,
		"message":        "已切换主库并写入持久化文件，重启后仍生效",
	})
}

// ---- helpers ----

func validateRestoreURL(raw string) (*url.URL, error) {
	if raw == "" {
		return nil, fmt.Errorf("url 不能为空")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("url 无效")
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) < 4 || parts[0] != "db_save" || !dbNameIdent.MatchString(parts[1]) {
		return nil, fmt.Errorf("路径须以 /db_save/{主库名}/ 开头")
	}
	return u, nil
}

// downloadBackup 优先用 COS SDK（私有桶需凭证），失败则匿名 HTTPS 兜底；都限制最大字节。
func downloadBackup(ctx context.Context, u *url.URL, key string, maxBytes int64) ([]byte, error) {
	if maxBytes <= 0 {
		maxBytes = 2 << 30
	}
	// 只有当 host 就是 Vino 自己的 COS 域时，才优先用 SDK（否则 SDK 的 BaseURL 指向的是本桶，无法下载其它 host）。
	cosBase := services.CosBase()
	if pu, err := url.Parse(cosBase); err == nil && strings.EqualFold(pu.Host, u.Host) {
		if data, err := services.CosGetObjectBytes(ctx, key, maxBytes); err == nil {
			return data, nil
		}
		// 失败时继续兜底 HTTPS
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 25 * time.Minute}
	r, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()
	if r.StatusCode < 200 || r.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d", r.StatusCode)
	}
	lim := io.LimitReader(r.Body, maxBytes+1)
	data, err := io.ReadAll(lim)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("备份超过最大允许大小 %d 字节", maxBytes)
	}
	return data, nil
}

func gunzipAll(data []byte, maxUncompressed int64) (string, error) {
	if maxUncompressed <= 0 {
		maxUncompressed = 16 << 30
	}
	gr, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	defer gr.Close()
	lim := io.LimitReader(gr, maxUncompressed+1)
	out, err := io.ReadAll(lim)
	if err != nil {
		return "", err
	}
	if int64(len(out)) > maxUncompressed {
		return "", fmt.Errorf("解压后超过最大允许大小 %d 字节", maxUncompressed)
	}
	return string(out), nil
}

func extractDumpDBName(sqlText, fallback string) string {
	if m := createDatabaseNameRe.FindStringSubmatch(sqlText); len(m) == 2 {
		if name := strings.TrimSpace(m[1]); name != "" {
			return name
		}
	}
	if m := createDatabaseBareRe.FindStringSubmatch(sqlText); len(m) == 2 {
		if name := strings.TrimSpace(m[1]); name != "" {
			return name
		}
	}
	return fallback
}

// stripCreateDatabaseAndUse 把 dump 顶层的 `CREATE DATABASE ...;` / `USE ...;` 直接删除。
// 这是 restore 流程的"最后一道防线"：无论库名能否被正则识别，都不让 dump 把 mysql 客户端的默认库切走。
// 表级别的 `CREATE TABLE ... ;` / `INSERT INTO ...` 不以 `CREATE DATABASE` 或 `USE ` 开头，不会被误删。
func stripCreateDatabaseAndUse(sqlText string) string {
	out := stripCreateDatabaseRe.ReplaceAllString(sqlText, "")
	out = stripUseRe.ReplaceAllString(out, "")
	return out
}

// rewriteDumpDBName：把反引号形式的库名全局替换；无反引号时仅替换首个 CREATE DATABASE 后的库名。
func rewriteDumpDBName(sqlText, oldName, newName string) string {
	if oldName == "" || oldName == newName {
		return sqlText
	}
	out := strings.ReplaceAll(sqlText, "`"+oldName+"`", "`"+newName+"`")
	if !strings.Contains(sqlText, "`"+oldName+"`") {
		re := regexp.MustCompile(fmt.Sprintf(`(?is)(CREATE\s+DATABASE(?:\s+IF\s+NOT\s+EXISTS)?\s+)%s(\s*;|\s*/\*|\s*$)`, regexp.QuoteMeta(oldName)))
		out = re.ReplaceAllString(out, "${1}"+newName+"$2")
		re2 := regexp.MustCompile(fmt.Sprintf(`(?is)(USE\s+)%s(\s*;|\s*$)`, regexp.QuoteMeta(oldName)))
		out = re2.ReplaceAllString(out, "${1}"+newName+"$2")
	}
	return out
}

func pickUnusedRestoreDBName(ctx context.Context, cfg *config.Config, base string) (string, error) {
	if !dbNameIdent.MatchString(base) {
		return "", fmt.Errorf("生成的库名非法: %s", base)
	}
	for suffix := 0; suffix < 100; suffix++ {
		candidate := base
		if suffix > 0 {
			candidate = fmt.Sprintf("%s_%d", base, suffix+1)
		}
		if !dbNameIdent.MatchString(candidate) {
			return "", fmt.Errorf("restore 库名过长或非法: %s", candidate)
		}
		exists, err := mysqlDatabaseExists(ctx, cfg, candidate)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("库 %s 等连续名称均已存在（请删除已有 restore 库或稍后重试）", base)
}

// adminDSN 返回连到 MySQL 实例的 DSN（可指定库名；空串表示不带库名）。
func adminDSN(cfg *config.Config, dbName string) string {
	tail := "/"
	if dbName != "" {
		tail = "/" + dbName
	}
	return fmt.Sprintf("%s:%s@tcp(%s:%d)%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DB.User, cfg.DB.Password, cfg.DB.Host, cfg.DB.Port, tail)
}

func mysqlDatabaseExists(ctx context.Context, cfg *config.Config, name string) (bool, error) {
	d, err := sql.Open("mysql", adminDSN(cfg, ""))
	if err != nil {
		return false, err
	}
	defer d.Close()
	row := d.QueryRowContext(ctx, "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = ?", name)
	var n int
	if err := row.Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

func listUserDatabases(ctx context.Context, cfg *config.Config) ([]string, error) {
	d, err := sql.Open("mysql", adminDSN(cfg, ""))
	if err != nil {
		return nil, err
	}
	defer d.Close()
	if err := d.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("连接 MySQL %s:%d 失败: %w", cfg.DB.Host, cfg.DB.Port, err)
	}
	// 用 information_schema 列库名，与 SHOW DATABASES 等价且对多数账号权限更一致
	q := `SELECT schema_name FROM information_schema.schemata
		WHERE LOWER(schema_name) NOT IN ('information_schema','mysql','performance_schema','sys')
		ORDER BY schema_name`
	rows, err := d.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// importToDatabase 通过 docker exec 到 mysql:8.0 容器把 SQL 文本 stdin 喂给 mysql 客户端。
// 导入前先 CREATE DATABASE IF NOT EXISTS 防 dump 缺建库语句。
func importToDatabase(ctx context.Context, cfg *config.Config, dbName, sqlText string) error {
	if _, err := os.Stat("/var/run/docker.sock"); err != nil {
		return fmt.Errorf("未挂载 /var/run/docker.sock，无法通过 vino-mysql 容器导入（请检查 docker-compose 配置）")
	}
	if _, err := exec.LookPath("docker"); err != nil {
		return fmt.Errorf("容器内未找到 docker CLI")
	}
	container := dbbackup.MysqlExecContainer()
	// 1) 建库
	createSQL := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;", dbName)
	if err := runMysqlClient(ctx, cfg, container, "", createSQL); err != nil {
		return fmt.Errorf("建库 %s: %w", dbName, err)
	}
	// 2) 导入 SQL
	if err := runMysqlClient(ctx, cfg, container, dbName, sqlText); err != nil {
		return err
	}
	return nil
}

func runMysqlClient(ctx context.Context, cfg *config.Config, container, dbName, sqlText string) error {
	args := []string{
		"exec", "-i",
		"-e", "MYSQL_PWD=" + cfg.DB.Password,
		container,
		"mysql",
		"-u" + cfg.DB.User,
	}
	if dbName != "" {
		args = append(args, dbName)
	}
	cmd := exec.CommandContext(ctx, "docker", args...)
	cmd.Stdin = strings.NewReader(sqlText)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if len(msg) > 800 {
			msg = msg[:800] + "…"
		}
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("%s", msg)
	}
	return nil
}

// previewAllTables 对 dbName 下所有表查前 10 行，字段转字符串并 base64 编码（脱敏）。
// 失败不抛错，以 note 字段标注并返回已拿到的部分。整体响应大小做硬上限。
func previewAllTables(ctx context.Context, cfg *config.Config, dbName string) []previewTable {
	const maxTotalBytes = 512 * 1024 // 512KB 响应上限
	d, err := sql.Open("mysql", adminDSN(cfg, dbName))
	if err != nil {
		return []previewTable{{Table: "_error", Note: "open db: " + err.Error()}}
	}
	defer d.Close()

	rowsT, err := d.QueryContext(ctx, "SHOW TABLES")
	if err != nil {
		return []previewTable{{Table: "_error", Note: "show tables: " + err.Error()}}
	}
	var tables []string
	for rowsT.Next() {
		var t string
		if err := rowsT.Scan(&t); err == nil {
			tables = append(tables, t)
		}
	}
	rowsT.Close()

	out := make([]previewTable, 0, len(tables))
	total := 0
	for _, t := range tables {
		if total >= maxTotalBytes {
			out = append(out, previewTable{Table: t, Note: "response size limit reached"})
			continue
		}
		pt := previewOneTable(ctx, d, t)
		for _, r := range pt.Rows {
			for _, c := range r {
				total += len(c)
			}
		}
		out = append(out, pt)
	}
	return out
}

func previewOneTable(ctx context.Context, d *sql.DB, table string) previewTable {
	pt := previewTable{Table: table}
	q := fmt.Sprintf("SELECT * FROM `%s` LIMIT 10", strings.ReplaceAll(table, "`", ""))
	rows, err := d.QueryContext(ctx, q)
	if err != nil {
		pt.Note = err.Error()
		return pt
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		pt.Note = err.Error()
		return pt
	}
	pt.Columns = cols
	for rows.Next() {
		raw := make([]sql.RawBytes, len(cols))
		ptrs := make([]any, len(cols))
		for i := range raw {
			ptrs[i] = &raw[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			pt.Note = err.Error()
			break
		}
		line := make([]string, len(cols))
		for i, b := range raw {
			if b == nil {
				line[i] = ""
				continue
			}
			line[i] = base64.StdEncoding.EncodeToString([]byte(b))
		}
		pt.Rows = append(pt.Rows, line)
	}
	return pt
}
