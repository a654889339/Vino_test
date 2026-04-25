package config

import (
	"os"
	"regexp"
	"strconv"
	"strings"
)

// dbNameIdent 用于 active_db 文件名合法性校验（与 admin_db_ops 保持一致）
var dbNameIdent = regexp.MustCompile(`^[A-Za-z0-9_]{1,64}$`)

type Config struct {
	Port    int
	NodeEnv string
	Log     struct {
		BackendDir string
		StatDir    string
	}
	JWT     struct {
		Secret    string
		ExpiresIn string
	}
	DB struct {
		Host     string
		Port     int
		Name     string
		User     string
		Password string
	}
	Wechat struct {
		AppID     string
		AppSecret string
	}
	Alipay struct {
		AppID       string
		PrivateKey  string
		PublicKey   string
	}
	Email struct {
		Enabled  bool
		Host     string
		Port     int
		Username string
		Password string
		From     string
		FromName string
	}
	SMS struct {
		Enabled           bool
		SecretID          string
		SecretKey         string
		SmsSdkAppID       string
		SignName          string
		TemplateID        string
		CodeExpireMinutes int
	}
	FrontendURL string
	// DBActiveNameFile 持久化「当前主库」文件路径；切换主库后写入，重启时读取优先于 DB_NAME。
	DBActiveNameFile string
	// DBRestoreMaxBytes 允许从 COS 下载并解压的单次备份最大字节数（gzip 压缩后）。
	DBRestoreMaxBytes int64
}

func getenv(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

func atoi(s string, def int) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

func Load() *Config {
	c := &Config{}
	c.Port = atoi(getenv("PORT", "5202"), 5202)
	c.NodeEnv = getenv("NODE_ENV", "development")
	c.JWT.Secret = getenv("JWT_SECRET", "vino_default_secret")
	c.JWT.ExpiresIn = getenv("JWT_EXPIRES_IN", "168h")
	c.DB.Host = getenv("DB_HOST", "localhost")
	c.DB.Port = atoi(getenv("DB_PORT", "3308"), 3308)
	c.DB.Name = getenv("DB_NAME", "vino_db")
	c.DB.User = getenv("DB_USER", "root")
	c.DB.Password = getenv("DB_PASSWORD", "vino_secret_2024")
	c.Wechat.AppID = getenv("WECHAT_APPID", "")
	c.Wechat.AppSecret = getenv("WECHAT_SECRET", "")
	c.Alipay.AppID = getenv("ALIPAY_APPID", "")
	c.Alipay.PrivateKey = strings.ReplaceAll(getenv("ALIPAY_PRIVATE_KEY", ""), "\\n", "\n")
	c.Alipay.PublicKey = strings.ReplaceAll(getenv("ALIPAY_PUBLIC_KEY", ""), "\\n", "\n")
	c.Email.Enabled = getenv("EMAIL_ENABLED", "false") == "true"
	c.Email.Host = getenv("EMAIL_HOST", "smtp.qq.com")
	c.Email.Port = atoi(getenv("EMAIL_PORT", "587"), 587)
	c.Email.Username = getenv("EMAIL_USERNAME", "")
	c.Email.Password = getenv("EMAIL_PASSWORD", "")
	c.Email.From = getenv("EMAIL_FROM", "")
	c.Email.FromName = getenv("EMAIL_FROM_NAME", "Vino服务")
	c.SMS.Enabled = getenv("SMS_ENABLED", "false") == "true"
	c.SMS.SecretID = getenv("TENCENT_SMS_SECRET_ID", "")
	c.SMS.SecretKey = getenv("TENCENT_SMS_SECRET_KEY", "")
	c.SMS.SmsSdkAppID = getenv("TENCENT_SMS_APP_ID", "")
	c.SMS.SignName = getenv("TENCENT_SMS_SIGN_NAME", "Vino服务")
	c.SMS.TemplateID = getenv("TENCENT_SMS_TEMPLATE_ID", "")
	c.SMS.CodeExpireMinutes = atoi(getenv("SMS_CODE_EXPIRE_MINUTES", "5"), 5)
	c.FrontendURL = getenv("FRONTEND_URL", "http://106.54.50.88:5201")
	c.Log.BackendDir = getenv("LOG_BACKEND_DIR", "data/logs/backend")
	c.Log.StatDir = getenv("LOG_STAT_DIR", "data/logs/stat")
	c.DBActiveNameFile = getenv("DB_ACTIVE_NAME_FILE", "data/state/active_db")
	c.DBRestoreMaxBytes = int64(atoi(getenv("DB_RESTORE_MAX_BYTES", "2147483648"), 2147483648))
	// 若存在已持久化的「当前主库」文件（切换后写入）则覆盖 DB.Name，重启后仍连切换后的库。
	if b, err := os.ReadFile(c.DBActiveNameFile); err == nil {
		name := strings.TrimSpace(string(b))
		if name != "" && dbNameIdent.MatchString(name) {
			c.DB.Name = name
		}
	}
	return c
}

// COSConfigured is true when Tencent COS credentials are present (same as business uploads).
func (c *Config) COSConfigured() bool {
	return getenv("COS_SECRET_ID", "") != "" && getenv("COS_SECRET_KEY", "") != ""
}
