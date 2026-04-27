package phoneverifycode

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Provider string

const (
	ProviderTencent Provider = "tencent"
	ProviderAliyun  Provider = "aliyun"
)

type Policy struct {
	CodeExpireMinutes int `yaml:"code_expire_minutes"`
	CooldownSeconds   int `yaml:"cooldown_seconds"`
}

type TencentSMS struct {
	SecretID    string `yaml:"secret_id"`
	SecretKey   string `yaml:"secret_key"`
	SmsSdkAppID string `yaml:"sms_sdk_app_id"`
	SignName    string `yaml:"sign_name"`
	TemplateID  string `yaml:"template_id"`
	Region      string `yaml:"region"`
}

type AliyunSMS struct {
	AccessKeyID     string `yaml:"access_key_id"`
	AccessKeySecret string `yaml:"access_key_secret"`
	Endpoint        string `yaml:"endpoint"`
	SignName        string `yaml:"sign_name"`
	TemplateCode    string `yaml:"template_code"`
}

type FileConfig struct {
	Enabled  bool      `yaml:"enabled"`
	Provider Provider  `yaml:"provider"`
	Policy   Policy    `yaml:"policy"`
	Tencent  TencentSMS `yaml:"tencent"`
	Aliyun   AliyunSMS  `yaml:"aliyun"`
}

func LoadFileConfig(path string) (*FileConfig, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read phone verify code config: %w", err)
	}
	var c FileConfig
	if err := yaml.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("yaml: %w", err)
	}

	// Sensitive fields MUST come from env and override YAML (YAML can keep placeholders / non-secret defaults).
	// Tencent
	if v := strings.TrimSpace(os.Getenv("PHONE_VERIFY_TENCENT_SECRET_ID")); v != "" {
		c.Tencent.SecretID = v
	}
	if v := strings.TrimSpace(os.Getenv("PHONE_VERIFY_TENCENT_SECRET_KEY")); v != "" {
		c.Tencent.SecretKey = v
	}
	// Aliyun
	if v := strings.TrimSpace(os.Getenv("PHONE_VERIFY_ALIYUN_ACCESS_KEY_ID")); v != "" {
		c.Aliyun.AccessKeyID = v
	}
	if v := strings.TrimSpace(os.Getenv("PHONE_VERIFY_ALIYUN_ACCESS_KEY_SECRET")); v != "" {
		c.Aliyun.AccessKeySecret = v
	}

	// Feature switch (default: disabled). Env overrides YAML.
	if v := strings.TrimSpace(os.Getenv("PHONE_VERIFY_ENABLED")); v != "" {
		vv := strings.ToLower(v)
		if vv == "1" || vv == "true" || vv == "yes" || vv == "on" {
			c.Enabled = true
		} else if vv == "0" || vv == "false" || vv == "no" || vv == "off" {
			c.Enabled = false
		}
	}

	if c.Policy.CodeExpireMinutes <= 0 {
		c.Policy.CodeExpireMinutes = 5
	}
	if c.Policy.CooldownSeconds <= 0 {
		c.Policy.CooldownSeconds = 60
	}
	if c.Provider == "" {
		c.Provider = ProviderTencent
	}
	return &c, nil
}

