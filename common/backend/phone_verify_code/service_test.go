package phoneverifycode

import "testing"

func resetStoreForTest() {
	smsMu.Lock()
	defer smsMu.Unlock()
	smsCodes = map[string]*smsRec{}
	smsSendM = map[string]int64{}
}

func TestService_Disabled(t *testing.T) {
	resetStoreForTest()
	s := NewService(&FileConfig{Enabled: false, Provider: ProviderTencent, Policy: Policy{CodeExpireMinutes: 5, CooldownSeconds: 0}})
	s.SendTencent = func(tc TencentSMS, e164 string, templateParams []string) error {
		t.Fatalf("sender should not be called when disabled")
		return nil
	}
	if err := s.SendSMSCode("13800138000"); err == nil {
		t.Fatalf("expected error when disabled")
	}
	if ok, _ := s.VerifySMSCode("13800138000", "123456"); ok {
		t.Fatalf("expected verify to fail when disabled")
	}
}

func TestService_SendAndVerify(t *testing.T) {
	resetStoreForTest()
	s := NewService(&FileConfig{Enabled: true, Provider: ProviderTencent, Policy: Policy{CodeExpireMinutes: 5, CooldownSeconds: 0}})
	s.SendTencent = func(tc TencentSMS, e164 string, templateParams []string) error {
		if e164 != "+8613800138000" {
			t.Fatalf("unexpected e164: %q", e164)
		}
		return nil
	}
	if err := s.SendSMSCode("13800138000"); err != nil {
		t.Fatalf("send: %v", err)
	}
	// Pull code from in-memory store (same package).
	smsMu.Lock()
	rec := smsCodes["13800138000"]
	smsMu.Unlock()
	if rec == nil || rec.code == "" {
		t.Fatalf("expected code stored")
	}
	if ok, msg := s.VerifySMSCode("13800138000", rec.code); !ok || msg != "" {
		t.Fatalf("verify failed ok=%v msg=%q", ok, msg)
	}
	// reused should fail
	if ok, _ := s.VerifySMSCode("13800138000", rec.code); ok {
		t.Fatalf("expected used code to fail")
	}
}

