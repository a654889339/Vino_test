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

	"github.com/disintegration/imaging"
	cos "github.com/tencentyun/cos-go-sdk-v5"
	_ "golang.org/x/image/webp"
)

const (
	cosBucket = "itsyourturnmy-1256887166"
	cosRegion = "ap-singapore"
)

var cosBaseURL = fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cosBucket, cosRegion)

// CosConfigured reports whether COS credentials are set (uploads / backups).
func CosConfigured() bool {
	sid := os.Getenv("COS_SECRET_ID")
	sk := os.Getenv("COS_SECRET_KEY")
	return sid != "" && sk != ""
}

// CosBucket returns the configured bucket id (name-appid), for admin responses.
func CosBucket() string { return cosBucket }

func validateBackupKey(key string) error {
	key = strings.TrimSpace(key)
	if key == "" || strings.Contains(key, "..") || strings.Contains(key, "\\") {
		return fmt.Errorf("invalid key")
	}
	if strings.HasPrefix(key, "log/backend/") || strings.HasPrefix(key, "db_save/") {
		return nil
	}
	return fmt.Errorf("backup key must use log/backend/ or db_save/ prefix")
}

// PutBackupObject uploads a private object (audit hourly logs, DB dump). No public-read ACL.
func PutBackupObject(ctx context.Context, key string, body []byte, contentType string) error {
	if err := validateBackupKey(key); err != nil {
		return err
	}
	c, err := cosClient()
	if err != nil {
		return err
	}
	_, err = c.Object.Put(ctx, key, bytes.NewReader(body), &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: contentType,
		},
	})
	return err
}

func cosClient() (*cos.Client, error) {
	sid := os.Getenv("COS_SECRET_ID")
	sk := os.Getenv("COS_SECRET_KEY")
	if sid == "" || sk == "" {
		return nil, fmt.Errorf("COS not configured")
	}
	u, _ := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cosBucket, cosRegion))
	b := &cos.BaseURL{BucketURL: u}
	return cos.NewClient(b, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  sid,
			SecretKey: sk,
		},
	}), nil
}

func CosBase() string { return cosBaseURL }

var (
	thumbKeyGoodsOrTypeLarge     = regexp.MustCompile(`^(vino/items/(?:goods|type)/\d+)/large_image(\.[^/.]+)$`)
	thumbKeyGoodsOrTypeLargeEn   = regexp.MustCompile(`^(vino/items/(?:goods|type)/\d+)/large_image_en(\.[^/.]+)$`)
	thumbKeyMainPageImage        = regexp.MustCompile(`^(vino/main_page/[^/]+)/image(\.[^/.]+)$`)
	thumbKeyMainPageImageEn      = regexp.MustCompile(`^(vino/main_page/[^/]+)/image_en(\.[^/.]+)$`)
	thumbKeyNoDeriveBasePrefixes = regexp.MustCompile(`^(?:icon|icon_en|scan|cover_thumbnail|cover_thumbnail_en)(?:\.|$)`)
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
	if m := thumbKeyGoodsOrTypeLarge.FindStringSubmatch(key); len(m) == 3 {
		return m[1] + "/cover_thumbnail" + m[2]
	}
	if m := thumbKeyGoodsOrTypeLargeEn.FindStringSubmatch(key); len(m) == 3 {
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
	if !strings.HasPrefix(u, cosBaseURL+"/") {
		return ""
	}
	q := strings.Index(u, "?")
	if q >= 0 {
		u = u[:q]
	}
	key := strings.TrimPrefix(u, cosBaseURL+"/")
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
	return cosBaseURL + "/" + tk
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
	return cosBaseURL + "/" + key, nil
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
	return cosBaseURL + "/" + key, nil
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
	return cosBaseURL + "/" + key, nil
}

func IsKeyAllowedForProxy(key string) bool {
	if key == "" || strings.Contains(key, "..") || strings.Contains(key, "\\") {
		return false
	}
	if strings.HasPrefix(key, "vino/uploads/") ||
		strings.HasPrefix(key, "vino/main_page/") ||
		strings.HasPrefix(key, "vino/main_animation/") ||
		strings.HasPrefix(key, "vino/items/") {
		return true
	}
	return false
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
	w.Header().Set("Cache-Control", "public, max-age=300")
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
