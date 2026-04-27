package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"vino/backend/internal/config"
	"vino/backend/internal/configdata"
	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"
	"vino/backend/internal/services"
	"vino/backend/internal/vinomediacfg"

	"github.com/gin-gonic/gin"
)

func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "Vino服务运行中", "timestamp": time.Now().UTC().Format(time.RFC3339)})
}

func AppStatus(c *gin.Context) {
	flags := services.GetFeatureFlags()
	resp.OK(c, gin.H{
		"maintenanceMode":         flags.MaintenanceMode,
		"enableRegister":          flags.EnableRegister,
		"enableCreateOrder":       flags.EnableCreateOrder,
		"enableCreateGoodsOrder":  flags.EnableGoodsOrder,
		"enableCreateAddress":     flags.EnableCreateAddr,
		"updatedAtUnixMs":         flags.UpdatedAtUnixMs,
		"message":                 func() string { if flags.MaintenanceMode { return "系统维护中" }; return "ok" }(),
	})
}

func AnalyticsPageView(c *gin.Context) {
	var body struct {
		App  string `json:"app"`
		Path string `json:"path"`
	}
	_ = c.ShouldBindJSON(&body)
	app := normalizeAnalyticsApp(body.App)
	p, ok := normalizeAnalyticsPath(body.Path)
	if !ok {
		resp.OK(c, gin.H{"skipped": true})
		return
	}
	pageKey := app + ":" + p
	visitDate := time.Now().Format("2006-01-02")
	err := db.DB.Exec(
		"INSERT INTO page_visit_daily (page_key, visit_date, `count`, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW()) ON DUPLICATE KEY UPDATE `count` = `count` + 1, updated_at = NOW()",
		pageKey, visitDate,
	).Error
	if err != nil {
		resp.Err(c, 500, 1, "记录失败")
		return
	}
	resp.OKMsg(c, "ok")
}

func AnalyticsStats(c *gin.Context) {
	type row struct {
		PageKey string  `gorm:"column:pageKey"`
		Total   float64 `gorm:"column:total"`
		D7      float64 `gorm:"column:d7"`
		D30     float64 `gorm:"column:d30"`
		D90     float64 `gorm:"column:d90"`
	}
	var rows []row
	sql := `SELECT page_key AS pageKey,
		SUM(` + "`count`" + `) AS total,
		SUM(CASE WHEN visit_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN ` + "`count`" + ` ELSE 0 END) AS d7,
		SUM(CASE WHEN visit_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) THEN ` + "`count`" + ` ELSE 0 END) AS d30,
		SUM(CASE WHEN visit_date >= DATE_SUB(CURDATE(), INTERVAL 89 DAY) THEN ` + "`count`" + ` ELSE 0 END) AS d90
		FROM page_visit_daily
		GROUP BY page_key
		HAVING SUM(` + "`count`" + `) > 0
		ORDER BY total DESC`
	if err := db.DB.Raw(sql).Scan(&rows).Error; err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	type aggRow struct {
		PageKey string
		Total   int
		D7      int
		D30     int
		D90     int
	}
	byKey := map[string]*aggRow{}
	for _, r := range rows {
		key, ok := normalizeAnalyticsPageKey(r.PageKey)
		if !ok {
			continue
		}
		a := byKey[key]
		if a == nil {
			a = &aggRow{PageKey: key}
			byKey[key] = a
		}
		a.Total += int(r.Total)
		a.D7 += int(r.D7)
		a.D30 += int(r.D30)
		a.D90 += int(r.D90)
	}
	merged := make([]*aggRow, 0, len(byKey))
	for _, r := range byKey {
		merged = append(merged, r)
	}
	sort.Slice(merged, func(i, j int) bool {
		if merged[i].Total == merged[j].Total {
			return merged[i].PageKey < merged[j].PageKey
		}
		return merged[i].Total > merged[j].Total
	})
	out := make([]gin.H, 0, len(merged))
	for _, r := range merged {
		out = append(out, gin.H{
			"pageKey": r.PageKey, "total": r.Total, "last7Days": r.D7, "last30Days": r.D30, "lastQuarter": r.D90,
		})
	}
	resp.OK(c, gin.H{"rows": out})
}

func normalizeAnalyticsApp(app string) string {
	app = strings.TrimSpace(app)
	if app != "toc" && app != "outlet" && app != "mp" {
		return "toc"
	}
	return app
}

func normalizeAnalyticsPageKey(pageKey string) (string, bool) {
	pageKey = strings.TrimSpace(pageKey)
	app := "toc"
	path := pageKey
	if i := strings.Index(pageKey, ":"); i >= 0 {
		app = normalizeAnalyticsApp(pageKey[:i])
		path = pageKey[i+1:]
	}
	normalizedPath, ok := normalizeAnalyticsPath(path)
	if !ok {
		return "", false
	}
	return app + ":" + normalizedPath, true
}

func normalizeAnalyticsPath(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		raw = "/"
	}
	if len(raw) > 1000 {
		raw = raw[:1000]
	}
	path, query := raw, ""
	if u, err := url.Parse(raw); err == nil {
		if u.Path != "" || u.RawQuery != "" || u.Scheme != "" || u.Host != "" {
			path = u.Path
			query = u.RawQuery
		}
	}
	if query == "" {
		if i := strings.Index(path, "?"); i >= 0 {
			query = path[i+1:]
			path = path[:i]
		}
	}
	if i := strings.Index(path, "#"); i >= 0 {
		path = path[:i]
	}
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if path != "/" {
		path = strings.TrimRight(path, "/")
	}
	lowerPath := strings.ToLower(path)
	lowerQuery := strings.ToLower(query)
	if path == "/" && strings.Contains(lowerQuery, "wework_cfm_code") {
		return "", false
	}
	if strings.HasSuffix(lowerPath, "/group.html") || lowerPath == "/group.html" {
		return "", false
	}
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) >= 2 {
		switch parts[0] {
		case "goods-orders":
			if isAnalyticsIDSegment(parts[1]) {
				return "/goods-orders/detail", true
			}
		case "orders":
			if isAnalyticsIDSegment(parts[1]) {
				return "/orders/detail", true
			}
		case "guide", "guide-detail":
			return "/guide/detail", true
		case "service":
			return "/service/detail", true
		}
	}
	if len(path) > 500 {
		path = path[:500]
	}
	return path, true
}

func isAnalyticsIDSegment(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func SeedData(c *gin.Context) {
	users := queryInt(c, "users", 10000)
	products := queryInt(c, "products", 10000)
	var cats []models.InventoryCategory
	db.DB.Find(&cats)
	if len(cats) == 0 {
		for _, name := range []string{"空调", "冰箱", "洗衣机", "热水器", "其他"} {
			db.DB.Create(&models.InventoryCategory{Name: name, SortOrder: 0, Status: "active"})
		}
		db.DB.Find(&cats)
	}
	catIDs := make([]int, len(cats))
	for i, c := range cats {
		catIDs[i] = c.ID
	}
	const batch = 500
	dummyHash := "$2b$10$dummyHashForSeedDataOnly00000000000000000000000000"
	names1 := []string{"张", "李", "王", "刘", "陈"}
	names2 := []string{"伟", "芳", "娜", "敏", "静"}
	prefixes := []string{"空调", "冰箱", "洗衣机"}
	suffixes := []string{"Pro", "Max", "Air"}
	tagsPool := []string{"新品", "热销", "特价"}
	for i := 0; i < users; i += batch {
		n := batch
		if i+n > users {
			n = users - i
		}
		for j := 0; j < n; j++ {
			idx := i + j
			b := make([]byte, 4)
			_, _ = rand.Read(b)
			hexv := hex.EncodeToString(b)
			phone := fmt.Sprintf("1%02d%08d", 30+idx%70, idx%100000000)
			email := fmt.Sprintf("test%d_%s@seed.local", idx, hexv)
			uname := fmt.Sprintf("test_%s_%d", hexv, idx)
			nick := names1[idx%len(names1)] + names2[idx%len(names2)] + fmt.Sprintf("%d", idx%999)
			em := email
			u := models.User{Username: uname, Password: dummyHash, Email: &em, Phone: phone, Nickname: nick, Role: "user", Status: "active"}
			_ = db.DB.Create(&u).Error
		}
	}
	rint := func(idx int) int { return idx % 100000 }
	for i := 0; i < products; i += batch {
		n := batch
		if i+n > products {
			n = products - i
		}
		for j := 0; j < n; j++ {
			idx := i + j
			b := make([]byte, 3)
			_, _ = rand.Read(b)
			hexv := strings.ToUpper(hex.EncodeToString(b))
			tags := ""
			if rint(idx)%4 != 0 {
				tags = tagsPool[idx%len(tagsPool)]
			}
			st := "active"
			if rint(idx)%10 == 0 {
				st = "inactive"
			}
			p := models.InventoryProduct{
				CategoryID:   catIDs[idx%len(catIDs)],
				Name:         prefixes[idx%len(prefixes)] + " " + suffixes[idx%len(suffixes)] + "-" + hexv,
				SerialNumber: fmt.Sprintf("SN%06d%s", idx, hexv),
				SortOrder:    rint(idx) % 100,
				Status:       st,
				Tags:         tags,
			}
			_ = db.DB.Create(&p).Error
		}
	}
	resp.OKMsg(c, fmt.Sprintf("已生成 %d 个用户、%d 个库存商品", users, products))
}

// MediaCosConfig 返回仓内 vino.media.yaml 的 ossPublicBaseDefault 及白名单等；与三端 setCosMediaConfig 约定一致。
func MediaCosConfig(c *gin.Context) {
	c.Writer.Header().Set("Cache-Control", "no-store")
	f := vinomediacfg.Get()
	base := strings.TrimSpace(services.CosBase())
	if f != nil {
		if s := strings.TrimSpace(f.OssPublicBaseDefault); s != "" {
			base = strings.TrimRight(s, "/")
		}
	}
	prefixes := services.CosProxyAllowedPrefixes()
	mediaTTL := services.CosMediaConfigTTLMs
	imgTTL := services.CosMediaImageDisplayCacheTTLMs
	project := "vino"
	cloudProvider := ""
	if f != nil {
		if len(f.CosProxyAllowedPrefixes) > 0 {
			prefixes = f.CosProxyAllowedPrefixes
		}
		if f.MediaConfigTtlMs > 0 {
			mediaTTL = f.MediaConfigTtlMs
		}
		if f.ImageDisplayCacheTtlMs > 0 {
			imgTTL = f.ImageDisplayCacheTtlMs
		}
		if s := strings.TrimSpace(f.Project); s != "" {
			project = s
		}
		if s := strings.TrimSpace(f.CloudProvider); s != "" {
			cloudProvider = s
		}
	}
	resp.OK(c, map[string]any{
		"project":                 project,
		"cloudProvider":           cloudProvider,
		"ossPublicBaseDefault":   base,
		"cosHost":                 base,
		"cosProxyAllowedPrefixes": prefixes,
		"mediaConfigTtlMs":        mediaTTL,
		"imageDisplayCacheTtlMs":  imgTTL,
		"frontPageConfig": func() any {
			if f == nil || f.FrontPageConfig == nil {
				return nil
			}
			root := strings.Trim(strings.TrimSpace(f.FrontPageConfig.Root), "/")
			carTpl := strings.Trim(strings.TrimSpace(f.FrontPageConfig.HomepageCarouselTemplate), "/")
			iconTpl := strings.Trim(strings.TrimSpace(f.FrontPageConfig.ProductIconTemplate), "/")
			coverTpl := strings.Trim(strings.TrimSpace(f.FrontPageConfig.ProductCoverTemplate), "/")
			coverThumbTpl := strings.Trim(strings.TrimSpace(f.FrontPageConfig.ProductCoverThumbTemplate), "/")
			if root == "" && carTpl == "" && iconTpl == "" && coverTpl == "" && coverThumbTpl == "" {
				return nil
			}
			return map[string]any{
				"root":                    root,
				"homepageCarouselTemplate": carTpl,
				"productIconTemplate":      iconTpl,
				"productCoverTemplate":     coverTpl,
				"productCoverThumbTemplate": coverThumbTpl,
			}
		}(),
	})
}

// MediaCatalog 返回嵌入的媒体资源目录（含商品 COS 命名约定），供三端只读拉取；5 分钟公共缓存。
func MediaCatalog(c *gin.Context) {
	c.Writer.Header().Set("Cache-Control", "public, max-age=300")
	var data any
	if err := json.Unmarshal(configdata.MediaAssetCatalogJSON(), &data); err != nil {
		resp.Err(c, 500, 500, "catalog invalid")
		return
	}
	resp.OK(c, data)
}

// MediaCosStream 同源代理读取 COS 对象（主要用于 Web 规避 CORS）。
// 仅允许白名单前缀（services.IsKeyAllowedForProxy），避免任意 key 读私有数据。
func MediaCosStream(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	key := strings.TrimSpace(c.Query("key"))
	if key == "" {
		resp.Err(c, 400, 400, "missing key")
		return
	}
	key = strings.TrimLeft(key, "/")
	if !services.IsKeyAllowedForProxy(key) {
		resp.Err(c, 403, 403, "key not allowed")
		return
	}
	_ = services.StreamCosObjectToResponse(c.Request.Context(), key, c.Writer)
}

func AdminGenerateThumbs(c *gin.Context, cfg *config.Config) {
	_ = cfg
	processed, failed, skipped := 0, 0, 0
	var guides []models.DeviceGuide
	db.DB.Select("id", "iconUrl", "coverImage", "qrcodeUrl").Find(&guides)
	seen := map[string]bool{}
	for _, g := range guides {
		for _, u := range []string{g.IconURL, g.CoverImage, g.QrcodeURL} {
			if u != "" && services.IsCosUploadURL(u) && !seen[u] {
				seen[u] = true
			}
		}
	}
	var hcs []models.HomeConfig
	db.DB.Where("imageUrl != ?", "").Select("imageUrl").Find(&hcs)
	for _, h := range hcs {
		if h.ImageURL != "" && services.IsCosUploadURL(h.ImageURL) && !seen[h.ImageURL] {
			seen[h.ImageURL] = true
		}
	}
	ctx := context.Background()
	for u := range seen {
		fname := filenameFromCosURL(u)
		if fname == "" {
			skipped++
			continue
		}
		buf, err := fetchImageBuffer(ctx, u)
		if err != nil || len(buf) == 0 {
			skipped++
			continue
		}
		tb, tct := services.GenerateThumbBuffer(buf, "image/jpeg")
		if len(tb) == 0 {
			skipped++
			continue
		}
		prefix, _ := services.ContentPrefixAndFileFromKey(services.URLToKey(u))
		if prefix == "" {
			skipped++
			continue
		}
		if _, err := services.UploadThumbWithContentPrefix(ctx, tb, fname, tct, prefix); err != nil {
			failed++
			continue
		}
		processed++
	}
	resp.OK(c, gin.H{
		"message":   fmt.Sprintf("已处理 %d 张缩略图，失败 %d，跳过 %d", processed, failed, skipped),
		"processed": processed, "failed": failed, "skipped": skipped,
	})
}

func fetchImageBuffer(ctx context.Context, u string) ([]byte, error) {
	key := services.URLToKey(u)
	if key != "" {
		return services.GetObjectBuffer(ctx, key)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Vino-Backend/1.0")
	respHTTP, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer respHTTP.Body.Close()
	if respHTTP.StatusCode != 200 {
		return nil, fmt.Errorf("http %d", respHTTP.StatusCode)
	}
	return io.ReadAll(respHTTP.Body)
}

func filenameFromCosURL(u string) string {
	_, f := services.ContentPrefixAndFileFromKey(services.URLToKey(u))
	return f
}

func I18nList(c *gin.Context) {
	if c.Query("paged") != "1" {
		var items []models.I18nText
		db.DB.Order("`key` ASC").Find(&items)
		resp.OK(c, items)
		return
	}
	page, pageSize := adminListPageParams(c)
	qb := db.DB.Model(&models.I18nText{})
	var total int64
	if err := qb.Count(&total).Error; err != nil {
		resp.Err(c, 500, 500, "统计失败")
		return
	}
	var items []models.I18nText
	offset := (page - 1) * pageSize
	if err := db.DB.Order("`key` ASC").Limit(pageSize).Offset(offset).Find(&items).Error; err != nil {
		resp.Err(c, 500, 500, "查询失败")
		return
	}
	resp.OK(c, gin.H{"list": items, "total": total, "page": page, "pageSize": pageSize})
}

func I18nBulkUpsert(c *gin.Context) {
	var body struct {
		Rows []struct {
			Key string `json:"key"`
			Zh  string `json:"zh"`
			En  string `json:"en"`
		} `json:"rows"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 1, "rows required")
		return
	}
	for _, r := range body.Rows {
		if r.Key == "" {
			continue
		}
		var it models.I18nText
		err := db.DB.Where("`key` = ?", r.Key).First(&it).Error
		if err != nil {
			db.DB.Create(&models.I18nText{Key: r.Key, Zh: r.Zh, En: r.En})
			continue
		}
		upd := false
		if r.Zh != "" {
			it.Zh = r.Zh
			upd = true
		}
		if r.En != "" {
			it.En = r.En
			upd = true
		}
		if upd {
			db.DB.Save(&it)
		}
	}
	resp.OK(c, gin.H{"saved": len(body.Rows), "message": "已保存"})
}

func I18nUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var it models.I18nText
	if err := db.DB.First(&it, id).Error; err != nil {
		resp.Err(c, 404, 1, "not found")
		return
	}
	var body struct {
		Zh, En string
	}
	_ = c.ShouldBindJSON(&body)
	if body.Zh != "" {
		it.Zh = body.Zh
	}
	if body.En != "" {
		it.En = body.En
	}
	db.DB.Save(&it)
	resp.OK(c, it)
}

func I18nRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db.DB.Delete(&models.I18nText{}, id)
	resp.OKMsg(c, "deleted")
}
