package phoneverifycode

import (
	"crypto/rand"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"
)

type smsRec struct {
	code      string
	expiresAt int64
	used      bool
}

var (
	smsMu    sync.Mutex
	smsCodes = map[string]*smsRec{}
	smsSendM = map[string]int64{}
)

// NormalizePhone 抽取数字并规范化 +86 前缀；仅用于 key 规范化与腾讯云 E.164 拼接。
func NormalizePhone(phone string) string {
	p := strings.TrimSpace(phone)
	p = strings.ReplaceAll(p, " ", "")
	p = strings.ReplaceAll(p, "\t", "")
	if strings.HasPrefix(p, "+86") {
		p = strings.TrimPrefix(p, "+86")
		p = strings.TrimLeft(p, " ")
	}
	var b strings.Builder
	for _, r := range p {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	d := b.String()
	if len(d) == 11 && d[0] == '1' {
		return d
	}
	if len(d) == 13 && strings.HasPrefix(d, "86") && len(d) >= 3 && d[2] == '1' {
		return d[2:]
	}
	if len(d) > 11 {
		tail := d[len(d)-11:]
		if tail[0] == '1' {
			return tail
		}
	}
	return d
}

func genSMSCode() string {
	b := make([]byte, 2)
	_, _ = io.ReadFull(rand.Reader, b)
	n := int(b[0])<<8 | int(b[1])
	if n < 0 {
		n = -n
	}
	return fmt.Sprintf("%06d", 100000+n%900000)
}

func canSendSMS(phone string, cooldown time.Duration) error {
	smsMu.Lock()
	defer smsMu.Unlock()
	key := NormalizePhone(phone)
	last := smsSendM[key]
	if last == 0 {
		return nil
	}
	if time.Since(time.Unix(0, last)) < cooldown {
		wait := int((cooldown - time.Since(time.Unix(0, last))).Seconds()) + 1
		return fmt.Errorf("发送过于频繁，请 %d 秒后再试", wait)
	}
	return nil
}

func setSMSCode(phone, code string, expire time.Duration) {
	smsMu.Lock()
	defer smsMu.Unlock()
	key := NormalizePhone(phone)
	smsCodes[key] = &smsRec{
		code:      code,
		expiresAt: time.Now().Add(expire).UnixNano(),
		used:      false,
	}
	smsSendM[key] = time.Now().UnixNano()
}

func verifySMSCode(phone, code string) (bool, string) {
	smsMu.Lock()
	defer smsMu.Unlock()
	key := NormalizePhone(phone)
	vc := smsCodes[key]
	if vc == nil {
		return false, "请先获取验证码"
	}
	if vc.used {
		return false, "验证码已使用，请重新获取"
	}
	if time.Now().UnixNano() > vc.expiresAt {
		delete(smsCodes, key)
		return false, "验证码已过期，请重新获取"
	}
	if strings.TrimSpace(code) != vc.code {
		return false, "验证码错误"
	}
	vc.used = true
	return true, ""
}

