package phoneverifycode

import (
	"fmt"
	"strings"
	"time"
)

type Service struct {
	Cfg *FileConfig

	SendTencent SendByTencent
	SendAliyun  SendByAliun
}

func NewService(cfg *FileConfig) *Service {
	return &Service{Cfg: cfg}
}

func (s *Service) cooldown() time.Duration {
	if s == nil || s.Cfg == nil {
		return 60 * time.Second
	}
	return time.Duration(s.Cfg.Policy.CooldownSeconds) * time.Second
}

func (s *Service) expire() time.Duration {
	if s == nil || s.Cfg == nil {
		return 5 * time.Minute
	}
	return time.Duration(s.Cfg.Policy.CodeExpireMinutes) * time.Minute
}

func (s *Service) SendSMSCode(phone string) error {
	if s == nil || s.Cfg == nil {
		return fmt.Errorf("sms config not loaded")
	}
	if !s.Cfg.Enabled {
		return fmt.Errorf("短信验证码功能未启用（enabled=false）")
	}
	if err := canSendSMS(phone, s.cooldown()); err != nil {
		return err
	}
	key := NormalizePhone(phone)
	if len(key) != 11 || key[0] != '1' {
		return fmt.Errorf("请输入正确的11位大陆手机号")
	}
	code := genSMSCode()
	switch s.Cfg.Provider {
	case ProviderTencent:
		if s.SendTencent == nil {
			return fmt.Errorf("tencent sms sender not configured")
		}
		e164 := "+86" + key
		if err := s.SendTencent(s.Cfg.Tencent, e164, buildTencentParams(code, s.Cfg.Policy.CodeExpireMinutes)); err != nil {
			return err
		}
	case ProviderAliyun:
		if s.SendAliyun == nil {
			return fmt.Errorf("aliyun sms sender not configured")
		}
		params := map[string]string{
			"code":   code,
			"minute": fmt.Sprintf("%d", s.Cfg.Policy.CodeExpireMinutes),
		}
		if err := s.SendAliyun(s.Cfg.Aliyun, key, params); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown sms provider: %s", strings.TrimSpace(string(s.Cfg.Provider)))
	}
	setSMSCode(phone, code, s.expire())
	return nil
}

func (s *Service) VerifySMSCode(phone, code string) (bool, string) {
	if s == nil || s.Cfg == nil {
		return false, "sms config not loaded"
	}
	if !s.Cfg.Enabled {
		return false, "短信验证码功能未启用"
	}
	return verifySMSCode(phone, code)
}

