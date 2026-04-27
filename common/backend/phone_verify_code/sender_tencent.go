package phoneverifycode

import (
	"fmt"
)

// SendByTencent 发送短信验证码。注意：此 common 包不直接引入腾讯云 SDK，
// 由项目侧（R-M / Vino）提供实际 SDK 调用，或在后续需要时再在 common 增加可选依赖。
type SendByTencent func(cfg TencentSMS, e164Phone string, templateParams []string) error

func buildTencentParams(code string, expireMinutes int) []string {
	return []string{code, fmt.Sprintf("%d", expireMinutes)}
}

