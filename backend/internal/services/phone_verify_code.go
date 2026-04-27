package services

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"vino/backend/internal/config"

	smscommon "shared/phoneverifycode"

	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/errors"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	sms "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/sms/v20210111"
)

var (
	phoneVerifyOnce sync.Once
	phoneVerifySvc  *smscommon.Service
)

func resolvePhoneVerifyConfigPath(project string) string {
	if p := strings.TrimSpace(os.Getenv("PHONE_VERIFY_CODE_CONFIG")); p != "" {
		return p
	}
	return filepath.Join("..", "common", "config", "phone_verify_code", project+".yaml")
}

func initPhoneVerifyService(cfg *config.Config) *smscommon.Service {
	var fc *smscommon.FileConfig
	p := resolvePhoneVerifyConfigPath("vino")
	if b, err := os.Stat(p); err == nil && b != nil {
		if c, err := smscommon.LoadFileConfig(p); err == nil {
			fc = c
		}
	}
	if fc == nil {
		fc = &smscommon.FileConfig{Enabled: false, Provider: smscommon.ProviderTencent}
	}
	s := smscommon.NewService(fc)
	// Startup self-check (non-sensitive).
	if fc != nil {
		switch fc.Provider {
		case smscommon.ProviderTencent:
			fmt.Printf("[phone_verify_code] enabled=%v provider=tencent appId=%q signName=%q templateId=%q region=%q secretReady=%v\n",
				fc.Enabled,
				fc.Tencent.SmsSdkAppID, fc.Tencent.SignName, fc.Tencent.TemplateID, fc.Tencent.Region,
				strings.TrimSpace(fc.Tencent.SecretID) != "" && strings.TrimSpace(fc.Tencent.SecretKey) != "")
		case smscommon.ProviderAliyun:
			fmt.Printf("[phone_verify_code] enabled=%v provider=aliyun endpoint=%q signName=%q templateCode=%q secretReady=%v\n",
				fc.Enabled,
				fc.Aliyun.Endpoint, fc.Aliyun.SignName, fc.Aliyun.TemplateCode,
				strings.TrimSpace(fc.Aliyun.AccessKeyID) != "" && strings.TrimSpace(fc.Aliyun.AccessKeySecret) != "")
		default:
			fmt.Printf("[phone_verify_code] enabled=%v provider=%q (unknown)\n", fc.Enabled, string(fc.Provider))
		}
	}
	s.SendTencent = func(tc smscommon.TencentSMS, e164 string, templateParams []string) error {
		if tc.SecretID == "" || tc.SecretKey == "" || tc.SmsSdkAppID == "" || tc.SignName == "" || tc.TemplateID == "" {
			return fmt.Errorf("短信服务未配置：请设置 provider=tencent 的 secret_id/secret_key/sms_sdk_app_id/sign_name/template_id")
		}
		cred := common.NewCredential(tc.SecretID, tc.SecretKey)
		cpf := profile.NewClientProfile()
		cpf.HttpProfile.Endpoint = "sms.tencentcloudapi.com"
		region := tc.Region
		if strings.TrimSpace(region) == "" {
			region = "ap-guangzhou"
		}
		client, _ := sms.NewClient(cred, region, cpf)
		req := sms.NewSendSmsRequest()
		req.SmsSdkAppId = common.StringPtr(tc.SmsSdkAppID)
		req.SignName = common.StringPtr(tc.SignName)
		req.TemplateId = common.StringPtr(tc.TemplateID)
		req.PhoneNumberSet = []*string{common.StringPtr(e164)}
		if len(templateParams) > 0 {
			out := make([]*string, 0, len(templateParams))
			for _, v := range templateParams {
				sv := v
				out = append(out, &sv)
			}
			req.TemplateParamSet = out
		}
		_, err := client.SendSms(req)
		if _, ok := err.(*errors.TencentCloudSDKError); ok {
			return fmt.Errorf("短信发送失败: %v", err)
		}
		return err
	}
	// Aliyun：如需启用，后续在项目内注入 SDK 实现。
	s.SendAliyun = nil
	return s
}

// InitPhoneVerifyService initializes singleton early (main startup).
func InitPhoneVerifyService(cfg *config.Config) {
	_ = phoneVerifyService(cfg)
}

// phoneVerifyService 返回进程内单例（惰性初始化）。
func phoneVerifyService(cfg *config.Config) *smscommon.Service {
	phoneVerifyOnce.Do(func() {
		phoneVerifySvc = initPhoneVerifyService(cfg)
	})
	return phoneVerifySvc
}

// phoneVerifyServiceUnsafe returns singleton without cfg; may be nil only before Init/first Send.
func phoneVerifyServiceUnsafe() *smscommon.Service { return phoneVerifySvc }
