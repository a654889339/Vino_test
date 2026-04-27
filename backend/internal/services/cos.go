package services

import (
	"bytes"
	"context"
	"fmt"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"

	"vino/backend/internal/vinomediacfg"

	"github.com/disintegration/imaging"
	cos "github.com/tencentyun/cos-go-sdk-v5"
	_ "golang.org/x/image/webp"
	"shared/cosbase"
)

// 桶与地域仅由此处与环境变量决定；公网基址以 common vino.media.yaml 的 ossPublicBaseDefault 为真源，勿在业务中硬编码桶域名。
func cosBucketEffective() string {
	s := strings.TrimSpace(os.Getenv("VINO_COS_BUCKET"))
	if s != "" {
		return s
	}
	return "itsyourturnmy-1256887166"
}

func cosRegionEffective() string {
	s := strings.TrimSpace(os.Getenv("VINO_COS_REGION"))
	if s != "" {
		return s
	}
	return "ap-singapore"
}

// CosConfigured reports whether COS credentials are set (uploads / backups).
func CosConfigured() bool {
	sid := os.Getenv("COS_SECRET_ID")
	sk := os.Getenv("COS_SECRET_KEY")
	return sid != "" && sk != ""
}

// CosBucket returns the configured bucket id (name-appid), for admin/SDK 等。
func CosBucket() string { return cosBucketEffective() }

// CosRegion returns COS 地域（如 ap-singapore），与 SDK 一致。
func CosRegion() string { return cosRegionEffective() }

// CosBase returns https://{bucket}.cos.{region}.myqcloud.com（无末尾斜杠），与上传返回 URL 前缀一致。
func CosBase() string {
	return fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cosBucketEffective(), cosRegionEffective())
}

// CosProxyKeyPrefixWhitelist 与 vino.media.yaml 的 cosProxyAllowedPrefixes 同源。变更请同步三端与 embed catalog。
var CosProxyKeyPrefixWhitelist = []string{
	"vino/uploads/",
	"vino/main_page/",
	"vino/main_animation/",
	"vino/items/",
	"front_page_config/",
}

// CosProxyAllowedPrefixes 返回白名单前缀切片副本（只读）。
func CosProxyAllowedPrefixes() []string {
	out := make([]string, len(CosProxyKeyPrefixWhitelist))
	copy(out, CosProxyKeyPrefixWhitelist)
	return out
}

const (
	// CosMediaConfigTTLMs 建议客户端重新拉取 cos-config 的间隔（毫秒），与三端运行时约定一致。
	CosMediaConfigTTLMs = 300000
	// CosMediaImageDisplayCacheTTLMs 建议的展示层媒体内存缓存 TTL（毫秒），如 blob / downloadFile 缓存。
	CosMediaImageDisplayCacheTTLMs = 300000
)

func validateBackupKey(key string) error {
	key = strings.TrimSpace(key)
	if key == "" || strings.Contains(key, "..") || strings.Contains(key, "\\") {
		return fmt.Errorf("invalid key")
	}
	if strings.HasPrefix(key, "log/backend/") || strings.HasPrefix(key, "log/stat/") || strings.HasPrefix(key, "db_save/") {
		return nil
	}
	return fmt.Errorf("backup key must use log/backend/, log/stat/ or db_save/ prefix")
}

func storageClient() (cosbase.StorageClient, error) {
	provider := cosbase.ProviderTencent
	if f := vinomediacfg.Get(); f != nil && strings.TrimSpace(f.CloudProvider) != "" {
		provider = strings.TrimSpace(f.CloudProvider)
	}
	return cosbase.NewStorageClient(cosbase.StorageConfig{
		CloudProvider: provider,
		BucketName:    cosBucketEffective(),
		Region:        cosRegionEffective(),
		PublicBase:    CosBase(),
		SecretID:      os.Getenv("COS_SECRET_ID"),
		SecretKey:     os.Getenv("COS_SECRET_KEY"),
	})
}

// PutBackupObject uploads a private object (audit hourly logs, DB dump). No public-read ACL.
func PutBackupObject(ctx context.Context, key string, body []byte, contentType string) error {
	if err := validateBackupKey(key); err != nil {
		return err
	}
	c, err := storageClient()
	if err != nil {
		return err
	}
	return c.PutBytes(ctx, key, body, contentType)
}

func cosClient() (*cos.Client, error) {
	sid := os.Getenv("COS_SECRET_ID")
	sk := os.Getenv("COS_SECRET_KEY")
	if sid == "" || sk == "" {
		return nil, fmt.Errorf("COS not configured")
	}
	u, _ := url.Parse(CosBase())
	b := &cos.BaseURL{BucketURL: u}
	return cos.NewClient(b, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  sid,
			SecretKey: sk,
		},
	}), nil
}

var (
	thumbKeyGoodsOrTypeLarge     = regexp.MustCompile(`^(vino/items/(?:goods|type)/\d+)/large_image(\.[^/.]+)$`)
	thumbKeyGoodsOrTypeLargeEn   = regexp.MustCompile(`^(vino/items/(?:goods|type)/\d+)/large_image_en(\.[^/.]+)$`)
	thumbKeyProductBannerZh      = regexp.MustCompile(`^(front_page_config/product/\d+)/banner_page_zh(\.[^/.]+)$`)
	thumbKeyProductBannerEn      = regexp.MustCompile(`^(front_page_config/product/\d+)/banner_page_en(\.[^/.]+)$`)
	thumbKeyMainPageImage        = regexp.MustCompile(`^(vino/main_page/[^/]+)/image(\.[^/.]+)$`)
	thumbKeyMainPageImageEn      = regexp.MustCompile(`^(vino/main_page/[^/]+)/image_en(\.[^/.]+)$`)
	thumbKeyNoDeriveBasePrefixes = regexp.MustCompile(`^(?:icon|icon_zh|icon_en|scan|cover_thumbnail|cover_thumbnail_zh|cover_thumbnail_en)(?:\.|$)`)
	thumbKeyProductLeafNoThumb   = regexp.MustCompile(`(?i)^(model3d\.glb|decal\.png|description\.pdf|model3d_skybox\.(jpg|jpeg|png|webp))$`)
)

// ThumbKeyFromOriginalKey 由原图 object key 推导缩略图 key（任意 vino/* 内容目录，与 Node 一致）
func ThumbKeyFromOriginalKey(key string) string {
	key = strings.TrimSpace(key)
	if key == "" || strings.Contains(key, "..") {
		return ""
	}
	if strings.Contains(key, "/thumb/") {
		return ""
	}
	last := strings.LastIndex(key, "/")
	if last < 0 {
		return ""
	}
	parent := key[:last]
	base := key[last+1:]
	if base == "" {
		return ""
	}
	if thumbKeyNoDeriveBasePrefixes.MatchString(base) {
		return ""
	}
	if strings.HasPrefix(key, "front_page_config/product/") && thumbKeyProductLeafNoThumb.MatchString(base) {
		return ""
	}
	if m := thumbKeyGoodsOrTypeLarge.FindStringSubmatch(key); len(m) == 3 {
		return m[1] + "/cover_thumbnail" + m[2]
	}
	if m := thumbKeyGoodsOrTypeLargeEn.FindStringSubmatch(key); len(m) == 3 {
		return m[1] + "/cover_thumbnail_en" + m[2]
	}
	if m := thumbKeyProductBannerZh.FindStringSubmatch(key); len(m) == 3 {
		return m[1] + "/cover_thumbnail_zh" + m[2]
	}
	if m := thumbKeyProductBannerEn.FindStringSubmatch(key); len(m) == 3 {
		return m[1] + "/cover_thumbnail_en" + m[2]
	}
	if m := thumbKeyMainPageImage.FindStringSubmatch(key); len(m) == 3 {
		return m[1] + "/cover_thumbnail" + m[2]
	}
	if m := thumbKeyMainPageImageEn.FindStringSubmatch(key); len(m) == 3 {
		return m[1] + "/cover_thumbnail_en" + m[2]
	}
	return parent + "/thumb/" + base
}

// UploadOriginalAndFlatCoverThumb 原图与缩略图同目录：如 large_image.* + cover_thumbnail.*（缩略图扩展名按编码结果）
func UploadOriginalAndFlatCoverThumb(ctx context.Context, buf []byte, origStem, ext, contentType, thumbStem string, maxWidth int, contentPrefix string) (url string, thumbURL string, err error) {
	ext = strings.TrimSpace(ext)
	if ext != "" && !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	if ext == "" || ext == ".bin" {
		ext = ".png"
		lower := strings.ToLower(contentType)
		switch {
		case strings.Contains(lower, "jpeg"), strings.Contains(lower, "jpg"):
			ext = ".jpg"
		case strings.Contains(lower, "png"):
			ext = ".png"
		case strings.Contains(lower, "webp"):
			ext = ".webp"
		case strings.Contains(lower, "gif"):
			ext = ".gif"
		}
	}
	if strings.TrimSpace(contentPrefix) == "" {
		contentPrefix = defaultContentPrefix
	}
	contentPrefix = strings.Trim(contentPrefix, "/")
	origFile := origStem + ext
	url, err = UploadCOSWithContentPrefix(ctx, buf, origFile, contentType, contentPrefix)
	if err != nil {
		return "", "", err
	}
	mw := thumbMaxWidth
	if maxWidth > 0 {
		mw = maxWidth
	}
	tb, tct := generateThumbBufferMax(buf, contentType, mw)
	if len(tb) == 0 {
		return url, "", nil
	}
	thumbExt := ".jpg"
	if strings.Contains(strings.ToLower(tct), "png") {
		thumbExt = ".png"
	}
	thumbFile := thumbStem + thumbExt
	tu, err := UploadCOSWithContentPrefix(ctx, tb, thumbFile, tct, contentPrefix)
	if err != nil {
		return url, "", nil
	}
	return url, tu, nil
}

// ContentPrefixAndFileFromKey 从原图 key 拆出内容前缀与文件名（用于补传缩略图等）
func ContentPrefixAndFileFromKey(key string) (contentPrefix string, file string) {
	if key == "" || strings.Contains(key, "/thumb/") {
		return "", ""
	}
	last := strings.LastIndex(key, "/")
	if last < 0 {
		return "", key
	}
	return key[:last], key[last+1:]
}

// URLToKey 从完整 COS URL 解析 object key（与 Node urlToKey 一致）
func URLToKey(fullURL string) string {
	if fullURL == "" {
		return ""
	}
	u := strings.TrimSpace(fullURL)
	base := CosBase()
	if !strings.HasPrefix(u, base+"/") {
		return ""
	}
	q := strings.Index(u, "?")
	if q >= 0 {
		u = u[:q]
	}
	key := strings.TrimPrefix(u, base+"/")
	if key == "" {
		return ""
	}
	return key
}

// IsCosUploadURL 与 Node isCosUploadUrl 一致：本桶可带缩略图的原图地址（非 thumb 路径下的对象）
func IsCosUploadURL(u string) bool {
	if u == "" {
		return false
	}
	k := URLToKey(u)
	return k != "" && isCosOriginalObjectKey(k)
}

func isCosOriginalObjectKey(key string) bool {
	if key == "" || strings.Contains(key, "..") || strings.Contains(key, "\\") {
		return false
	}
	if strings.Contains(key, "/thumb/") {
		return false
	}
	if strings.HasPrefix(key, "vino/uploads/") {
		return true
	}
	if strings.HasPrefix(key, "vino/main_page/") || strings.HasPrefix(key, "vino/main_animation/") {
		return true
	}
	if strings.HasPrefix(key, "vino/items/") {
		return true
	}
	if strings.HasPrefix(key, "front_page_config/") {
		return true
	}
	return false
}

func GetThumbURL(originalURL string) string {
	if originalURL == "" {
		return ""
	}
	k := URLToKey(originalURL)
	if k == "" {
		return ""
	}
	tk := ThumbKeyFromOriginalKey(k)
	if tk == "" {
		return ""
	}
	return CosBase() + "/" + tk
}

const thumbMaxWidth = 400

// GenerateThumbBuffer 生成缩略图（默认最大边 400px，与 Node 一致）
func GenerateThumbBuffer(buf []byte, contentType string) ([]byte, string) {
	return generateThumbBufferMax(buf, contentType, thumbMaxWidth)
}

func generateThumbBufferMax(buf []byte, contentType string, maxW int) ([]byte, string) {
	if maxW <= 0 {
		maxW = thumbMaxWidth
	}
	img, err := imaging.Decode(bytes.NewReader(buf))
	if err != nil {
		return nil, ""
	}
	if img.Bounds().Dx() > maxW || img.Bounds().Dy() > maxW {
		img = imaging.Fit(img, maxW, maxW, imaging.Lanczos)
	}
	lower := strings.ToLower(contentType)
	var out bytes.Buffer
	switch {
	case strings.Contains(lower, "png"):
		_ = png.Encode(&out, img)
		return out.Bytes(), "image/png"
	case strings.Contains(lower, "webp"):
		_ = jpeg.Encode(&out, img, &jpeg.Options{Quality: 82})
		return out.Bytes(), "image/jpeg"
	default:
		_ = jpeg.Encode(&out, img, &jpeg.Options{Quality: 82})
		return out.Bytes(), "image/jpeg"
	}
}

const defaultContentPrefix = "vino/uploads"

// UploadThumb 上传到 {contentPrefix}/thumb/
func UploadThumb(ctx context.Context, buf []byte, filename, contentType string) (string, error) {
	return UploadThumbWithContentPrefix(ctx, buf, filename, contentType, defaultContentPrefix)
}

// UploadThumbWithContentPrefix 在指定内容目录下写入缩略图
func UploadThumbWithContentPrefix(ctx context.Context, buf []byte, filename, contentType, contentPrefix string) (string, error) {
	contentPrefix = strings.Trim(contentPrefix, "/")
	key := contentPrefix + "/thumb/" + filename
	c, err := cosClient()
	if err != nil {
		return "", err
	}
	_, err = c.Object.Put(ctx, key, bytes.NewReader(buf), &cos.ObjectPutOptions{
		ACLHeaderOptions: &cos.ACLHeaderOptions{
			XCosACL: "public-read",
		},
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: contentType,
		},
	})
	if err != nil {
		return "", err
	}
	return CosBase() + "/" + key, nil
}

// UploadWithThumb 上传原图并生成缩略图（maxWidth 0 使用默认 400）
func UploadWithThumb(ctx context.Context, buf []byte, filename, contentType string, maxWidth int) (url string, thumbURL string, err error) {
	return UploadWithThumbWithContentPrefix(ctx, buf, filename, contentType, maxWidth, defaultContentPrefix)
}

// UploadWithThumbWithContentPrefix 指定内容目录前缀（如 vino/main_page、vino/items/goods/12）
func UploadWithThumbWithContentPrefix(ctx context.Context, buf []byte, filename, contentType string, maxWidth int, contentPrefix string) (url string, thumbURL string, err error) {
	if strings.TrimSpace(contentPrefix) == "" {
		contentPrefix = defaultContentPrefix
	}
	contentPrefix = strings.Trim(contentPrefix, "/")
	url, err = UploadCOSWithContentPrefix(ctx, buf, filename, contentType, contentPrefix)
	if err != nil {
		return "", "", err
	}
	mw := thumbMaxWidth
	if maxWidth > 0 {
		mw = maxWidth
	}
	tb, tct := generateThumbBufferMax(buf, contentType, mw)
	if len(tb) == 0 {
		return url, "", nil
	}
	tu, err := UploadThumbWithContentPrefix(ctx, tb, filename, tct, contentPrefix)
	if err != nil {
		return url, "", nil
	}
	return url, tu, nil
}

func UploadCOS(ctx context.Context, buf []byte, filename, contentType string) (string, error) {
	return UploadCOSWithContentPrefix(ctx, buf, filename, contentType, defaultContentPrefix)
}

// UploadCOSWithContentPrefix 原图写入 {contentPrefix}/{filename}
func UploadCOSWithContentPrefix(ctx context.Context, buf []byte, filename, contentType, contentPrefix string) (string, error) {
	contentPrefix = strings.Trim(contentPrefix, "/")
	key := contentPrefix + "/" + filename
	c, err := cosClient()
	if err != nil {
		return "", err
	}
	_, err = c.Object.Put(ctx, key, bytes.NewReader(buf), &cos.ObjectPutOptions{
		ACLHeaderOptions: &cos.ACLHeaderOptions{
			XCosACL: "public-read",
		},
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: contentType,
		},
	})
	if err != nil {
		return "", err
	}
	return CosBase() + "/" + key, nil
}

func UploadCOSReader(ctx context.Context, r io.Reader, filename, contentType string) (string, error) {
	return UploadCOSReaderWithContentPrefix(ctx, r, filename, contentType, defaultContentPrefix)
}

// UploadCOSReaderWithContentPrefix 流式上传原图
func UploadCOSReaderWithContentPrefix(ctx context.Context, r io.Reader, filename, contentType, contentPrefix string) (string, error) {
	contentPrefix = strings.Trim(contentPrefix, "/")
	key := contentPrefix + "/" + filename
	c, err := cosClient()
	if err != nil {
		return "", err
	}
	_, err = c.Object.Put(ctx, key, r, &cos.ObjectPutOptions{
		ACLHeaderOptions: &cos.ACLHeaderOptions{
			XCosACL: "public-read",
		},
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: contentType,
		},
	})
	if err != nil {
		return "", err
	}
	return CosBase() + "/" + key, nil
}

func IsKeyAllowedForProxy(key string) bool {
	if err := cosbase.ValidateKey(key); err != nil {
		return false
	}
	return cosbase.KeyMatchesAllowedPrefix(CosProxyKeyPrefixWhitelist, key)
}

func StreamCosObjectToResponse(ctx context.Context, key string, w http.ResponseWriter) error {
	c, err := cosClient()
	if err != nil {
		http.Error(w, `{"code":503,"message":"COS 未配置"}`, 503)
		return err
	}
	resp, err := c.Object.Get(ctx, key, nil)
	if err != nil {
		http.Error(w, "", 404)
		return err
	}
	defer resp.Body.Close()
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ct)
	// 对象读缓存由 Web/小程序在客户端 5 分钟实现；本接口不启用 HTTP 代理缓存
	w.Header().Set("Cache-Control", "no-store")
	_, err = io.Copy(w, resp.Body)
	return err
}

func GetObjectBuffer(ctx context.Context, key string) ([]byte, error) {
	c, err := cosClient()
	if err != nil {
		return nil, err
	}
	resp, err := c.Object.Get(ctx, key, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

// CosGetObjectBytes 使用已配置的 COS 凭证下载对象，限制最大字节数（含溢出探测），用于 DB 恢复等可能的私有桶场景。
// 若 maxBytes<=0 视为 2GiB；对象大于 maxBytes 时返回错误，避免一次性读入过大文件。
func CosGetObjectBytes(ctx context.Context, key string, maxBytes int64) ([]byte, error) {
	if maxBytes <= 0 {
		maxBytes = 2 << 30
	}
	key = strings.TrimLeft(strings.TrimSpace(key), "/")
	if key == "" || strings.Contains(key, "..") || strings.Contains(key, "\\") {
		return nil, fmt.Errorf("非法对象键")
	}
	c, err := cosClient()
	if err != nil {
		return nil, err
	}
	resp, err := c.Object.Get(ctx, key, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	lim := io.LimitReader(resp.Body, maxBytes+1)
	data, err := io.ReadAll(lim)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("对象超过最大允许大小 %d 字节", maxBytes)
	}
	return data, nil
}
