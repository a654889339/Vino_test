package services

import (
	"bytes"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"vino/backend/internal/config"
)

func loadWechatPayPrivateKey(cfg *config.Config) *rsa.PrivateKey {
	raw := ""
	if cfg != nil {
		raw = strings.TrimSpace(cfg.WeChatPay.PrivateKey)
		if raw == "" && cfg.WeChatPay.PrivateKeyPath != "" {
			if b, err := os.ReadFile(cfg.WeChatPay.PrivateKeyPath); err == nil {
				raw = string(b)
			}
		}
	}
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	if !strings.Contains(raw, "BEGIN") {
		raw = strings.ReplaceAll(raw, "\\n", "\n")
	}
	block, _ := pem.Decode([]byte(raw))
	if block == nil {
		return nil
	}
	k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		k2, err2 := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err2 != nil {
			return nil
		}
		return k2
	}
	if pk, ok := k.(*rsa.PrivateKey); ok {
		return pk
	}
	return nil
}

func IsWechatPayConfigured(cfg *config.Config) bool {
	return cfg != nil &&
		cfg.WeChatPay.Enabled &&
		cfg.WeChatPay.AppID != "" &&
		cfg.WeChatPay.MchID != "" &&
		cfg.WeChatPay.MchSerialNo != "" &&
		len(cfg.WeChatPay.APIV3Key) == 32 &&
		loadWechatPayPrivateKey(cfg) != nil &&
		cfg.WeChatPay.NotifyURL != ""
}

func buildPayAuth(cfg *config.Config, method, urlPath, bodyStr string, pk *rsa.PrivateKey) (string, error) {
	mchid := cfg.WeChatPay.MchID
	serial := cfg.WeChatPay.MchSerialNo
	ts := fmt.Sprintf("%d", time.Now().Unix())
	nonce := make([]byte, 16)
	_, _ = rand.Read(nonce)
	nonceStr := fmt.Sprintf("%x", nonce)
	msg := method + "\n" + urlPath + "\n" + ts + "\n" + nonceStr + "\n" + bodyStr + "\n"
	h := sha256.Sum256([]byte(msg))
	sig, err := rsa.SignPKCS1v15(nil, pk, crypto.SHA256, h[:])
	if err != nil {
		return "", err
	}
	signB64 := base64.StdEncoding.EncodeToString(sig)
	return fmt.Sprintf(`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",timestamp="%s",serial_no="%s",signature="%s"`,
		mchid, nonceStr, ts, serial, signB64), nil
}

func JsapiPrepay(cfg *config.Config, outTradeNo, description string, totalFen int, openid string) (map[string]interface{}, error) {
	pk := loadWechatPayPrivateKey(cfg)
	if pk == nil {
		return nil, fmt.Errorf("no private key")
	}
	urlPath := "/v3/pay/transactions/jsapi"
	body := map[string]interface{}{
		"appid":        cfg.WeChatPay.AppID,
		"mchid":        cfg.WeChatPay.MchID,
		"description":  description,
		"out_trade_no": outTradeNo,
		"notify_url":   cfg.WeChatPay.NotifyURL,
		"amount":       map[string]interface{}{"total": totalFen, "currency": "CNY"},
		"payer":        map[string]interface{}{"openid": openid},
	}
	bodyStr, _ := json.Marshal(body)
	auth, err := buildPayAuth(cfg, "POST", urlPath, string(bodyStr), pk)
	if err != nil {
		return nil, err
	}
	req, _ := http.NewRequest(http.MethodPost, "https://api.mch.weixin.qq.com"+urlPath, bytes.NewReader(bodyStr))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", auth)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	if resp.StatusCode >= 400 {
		return out, fmt.Errorf("%v", out)
	}
	return out, nil
}

func BuildMiniProgramPayParams(cfg *config.Config, prepayID string) (map[string]interface{}, error) {
	pk := loadWechatPayPrivateKey(cfg)
	if pk == nil {
		return nil, fmt.Errorf("no private key")
	}
	appID := cfg.WeChatPay.AppID
	ts := fmt.Sprintf("%d", time.Now().Unix())
	nonce := make([]byte, 16)
	_, _ = rand.Read(nonce)
	nonceStr := fmt.Sprintf("%x", nonce)
	pkg := "prepay_id=" + prepayID
	signStr := appID + "\n" + ts + "\n" + nonceStr + "\n" + pkg + "\n"
	h := sha256.Sum256([]byte(signStr))
	sig, err := rsa.SignPKCS1v15(nil, pk, crypto.SHA256, h[:])
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"appId":     appID,
		"timeStamp": ts,
		"nonceStr":  nonceStr,
		"package":   pkg,
		"signType":  "RSA",
		"paySign":   base64.StdEncoding.EncodeToString(sig),
	}, nil
}

// DecryptNotifyResource 解密微信支付 APIv3 回调 resource（AES-256-GCM）
func DecryptNotifyResource(cfg *config.Config, res map[string]interface{}) (map[string]interface{}, error) {
	ciphertext, _ := res["ciphertext"].(string)
	ad, _ := res["associated_data"].(string)
	nonceStr, _ := res["nonce"].(string)
	keyStr := cfg.WeChatPay.APIV3Key
	if len(keyStr) != 32 {
		return nil, fmt.Errorf("invalid api v3 key")
	}
	key := []byte(keyStr)
	nonceB := []byte(nonceStr)
	buf, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	plain, err := gcm.Open(nil, nonceB, buf, []byte(ad))
	if err != nil {
		return nil, err
	}
	var out map[string]interface{}
	if err := json.Unmarshal(plain, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func VerifyNotifySignature(cfg *config.Config, headers http.Header, body []byte) error {
	certText := ""
	if cfg != nil {
		certText = strings.TrimSpace(cfg.WeChatPay.PlatformCert)
		if certText == "" && cfg.WeChatPay.PlatformCertPath != "" {
			b, err := os.ReadFile(cfg.WeChatPay.PlatformCertPath)
			if err != nil {
				return err
			}
			certText = string(b)
		}
	}
	if certText == "" {
		return fmt.Errorf("微信支付平台证书未配置")
	}
	block, _ := pem.Decode([]byte(certText))
	if block == nil {
		return fmt.Errorf("微信支付平台证书 PEM 无效")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return err
	}
	pub, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return fmt.Errorf("微信支付平台证书不是 RSA")
	}
	ts := headers.Get("Wechatpay-Timestamp")
	nonce := headers.Get("Wechatpay-Nonce")
	sigB64 := headers.Get("Wechatpay-Signature")
	if ts == "" || nonce == "" || sigB64 == "" {
		return fmt.Errorf("微信支付回调签名头缺失")
	}
	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil {
		return err
	}
	msg := ts + "\n" + nonce + "\n" + string(body) + "\n"
	h := sha256.Sum256([]byte(msg))
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, h[:], sig)
}

func init() {
	_ = io.EOF
}
