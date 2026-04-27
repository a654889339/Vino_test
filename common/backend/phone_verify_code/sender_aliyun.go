package phoneverifycode

// SendByAliyun 发送短信验证码（项目侧注入实现）。
type SendByAliun func(cfg AliyunSMS, phone string, templateParams map[string]string) error

