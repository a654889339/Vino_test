package cosbase

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	aliyunoss "github.com/aliyun/aliyun-oss-go-sdk/oss"
	tencentcos "github.com/tencentyun/cos-go-sdk-v5"
)

const (
	ProviderAliyun  = "aliyun"
	ProviderTencent = "tencent"
)

type ObjectInfo struct {
	Key          string
	Size         int64
	LastModified time.Time
	ETag         string
}

type StorageConfig struct {
	CloudProvider string
	Endpoint      string
	BucketName    string
	Region        string
	PublicBase    string

	AccessKeyID     string
	AccessKeySecret string
	SecretID        string
	SecretKey       string
}

type StorageClient interface {
	PutBytes(ctx context.Context, key string, body []byte, contentType string) error
	Delete(ctx context.Context, key string) error
	Copy(ctx context.Context, srcKey, dstKey string) error
	Head(ctx context.Context, key string) (exists bool, contentType string, length int64, lastMod time.Time, err error)
	List(ctx context.Context, prefix string, maxKeys int) ([]ObjectInfo, error)
	GetObjectStream(ctx context.Context, key string) (rc io.ReadCloser, contentType string, contentLength int64, err error)
	SignedGetURL(ctx context.Context, key string, expire time.Duration) (string, error)
}

func NormalizeProvider(provider string) string {
	p := strings.ToLower(strings.TrimSpace(provider))
	switch p {
	case "", "oss", ProviderAliyun:
		return ProviderAliyun
	case "cos", ProviderTencent:
		return ProviderTencent
	default:
		return p
	}
}

func NewStorageClient(cfg StorageConfig) (StorageClient, error) {
	switch NormalizeProvider(cfg.CloudProvider) {
	case ProviderAliyun:
		return newAliyunStorage(cfg)
	case ProviderTencent:
		return newTencentStorage(cfg)
	default:
		return nil, fmt.Errorf("unsupported cloudProvider %q", cfg.CloudProvider)
	}
}

func ValidateProviderCredentials(cfg StorageConfig) error {
	switch NormalizeProvider(cfg.CloudProvider) {
	case ProviderAliyun:
		if strings.TrimSpace(cfg.Endpoint) == "" || strings.TrimSpace(cfg.BucketName) == "" ||
			strings.TrimSpace(cfg.AccessKeyID) == "" || strings.TrimSpace(cfg.AccessKeySecret) == "" {
			return fmt.Errorf("aliyun storage requires endpoint/bucket/accessKeyID/accessKeySecret")
		}
	case ProviderTencent:
		if strings.TrimSpace(cfg.BucketName) == "" || strings.TrimSpace(cfg.Region) == "" ||
			strings.TrimSpace(cfg.SecretID) == "" || strings.TrimSpace(cfg.SecretKey) == "" {
			return fmt.Errorf("tencent storage requires bucket/region/secretID/secretKey")
		}
	default:
		return fmt.Errorf("unsupported cloudProvider %q", cfg.CloudProvider)
	}
	return nil
}

type aliyunStorage struct {
	cfg    StorageConfig
	bucket *aliyunoss.Bucket
}

func newAliyunStorage(cfg StorageConfig) (*aliyunStorage, error) {
	if err := ValidateProviderCredentials(cfg); err != nil {
		return nil, err
	}
	endpoint := strings.TrimSpace(cfg.Endpoint)
	if endpoint != "" && !strings.HasPrefix(endpoint, "http") {
		endpoint = "https://" + endpoint
	}
	client, err := aliyunoss.New(endpoint, cfg.AccessKeyID, cfg.AccessKeySecret)
	if err != nil {
		return nil, err
	}
	b, err := client.Bucket(cfg.BucketName)
	if err != nil {
		return nil, err
	}
	cfg.Endpoint = endpoint
	return &aliyunStorage{cfg: cfg, bucket: b}, nil
}

func (s *aliyunStorage) PutBytes(ctx context.Context, key string, body []byte, contentType string) error {
	if err := ValidateKey(key); err != nil {
		return err
	}
	opts := []aliyunoss.Option{}
	if contentType != "" {
		opts = append(opts, aliyunoss.ContentType(contentType))
	}
	_ = ctx
	return s.bucket.PutObject(key, bytes.NewReader(body), opts...)
}

func (s *aliyunStorage) Delete(ctx context.Context, key string) error {
	if err := ValidateKey(key); err != nil {
		return err
	}
	_ = ctx
	return s.bucket.DeleteObject(key)
}

func (s *aliyunStorage) Copy(ctx context.Context, srcKey, dstKey string) error {
	if err := ValidateKey(srcKey); err != nil {
		return err
	}
	if err := ValidateKey(dstKey); err != nil {
		return err
	}
	_ = ctx
	_, err := s.bucket.CopyObject(srcKey, dstKey)
	return err
}

func (s *aliyunStorage) Head(ctx context.Context, key string) (bool, string, int64, time.Time, error) {
	if err := ValidateKey(key); err != nil {
		return false, "", 0, time.Time{}, err
	}
	_ = ctx
	ok, err := s.bucket.IsObjectExist(key)
	if err != nil || !ok {
		return ok, "", 0, time.Time{}, err
	}
	h, err := s.bucket.GetObjectMeta(key)
	if err != nil {
		return true, "", 0, time.Time{}, err
	}
	sz, _ := strconv.ParseInt(h.Get("Content-Length"), 10, 64)
	lm, _ := http.ParseTime(h.Get("Last-Modified"))
	return true, h.Get("Content-Type"), sz, lm, nil
}

func (s *aliyunStorage) List(ctx context.Context, prefix string, maxKeys int) ([]ObjectInfo, error) {
	if maxKeys <= 0 || maxKeys > 1000 {
		maxKeys = 100
	}
	_ = ctx
	res, err := s.bucket.ListObjects(aliyunoss.Prefix(strings.TrimLeft(prefix, "/")), aliyunoss.MaxKeys(maxKeys))
	if err != nil {
		return nil, err
	}
	out := make([]ObjectInfo, 0, len(res.Objects))
	for _, o := range res.Objects {
		out = append(out, ObjectInfo{Key: o.Key, Size: o.Size, LastModified: o.LastModified, ETag: strings.Trim(o.ETag, `"`)})
	}
	return out, nil
}

func (s *aliyunStorage) GetObjectStream(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	if err := ValidateKey(key); err != nil {
		return nil, "", 0, err
	}
	r, err := s.bucket.GetObject(key)
	if err != nil {
		return nil, "", 0, err
	}
	_, ct, n, _, _ := s.Head(ctx, key)
	return r, ct, n, nil
}

func (s *aliyunStorage) SignedGetURL(ctx context.Context, key string, expire time.Duration) (string, error) {
	if err := ValidateKey(key); err != nil {
		return "", err
	}
	if expire <= 0 {
		expire = time.Hour
	}
	_ = ctx
	return s.bucket.SignURL(key, aliyunoss.HTTPGet, int64(expire.Seconds()))
}

type tencentStorage struct {
	cfg    StorageConfig
	client *tencentcos.Client
}

func newTencentStorage(cfg StorageConfig) (*tencentStorage, error) {
	if err := ValidateProviderCredentials(cfg); err != nil {
		return nil, err
	}
	base := strings.TrimSpace(cfg.PublicBase)
	if base == "" {
		base = fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.BucketName, cfg.Region)
	}
	u, err := url.Parse(strings.TrimRight(base, "/"))
	if err != nil {
		return nil, err
	}
	client := tencentcos.NewClient(&tencentcos.BaseURL{BucketURL: u}, &http.Client{
		Transport: &tencentcos.AuthorizationTransport{
			SecretID:  cfg.SecretID,
			SecretKey: cfg.SecretKey,
		},
	})
	cfg.PublicBase = strings.TrimRight(base, "/")
	return &tencentStorage{cfg: cfg, client: client}, nil
}

func (s *tencentStorage) PutBytes(ctx context.Context, key string, body []byte, contentType string) error {
	if err := ValidateKey(key); err != nil {
		return err
	}
	opt := &tencentcos.ObjectPutOptions{}
	if contentType != "" {
		opt.ObjectPutHeaderOptions = &tencentcos.ObjectPutHeaderOptions{ContentType: contentType}
	}
	_, err := s.client.Object.Put(ctx, key, bytes.NewReader(body), opt)
	return err
}

func (s *tencentStorage) Delete(ctx context.Context, key string) error {
	if err := ValidateKey(key); err != nil {
		return err
	}
	_, err := s.client.Object.Delete(ctx, key)
	return err
}

func (s *tencentStorage) Copy(ctx context.Context, srcKey, dstKey string) error {
	if err := ValidateKey(srcKey); err != nil {
		return err
	}
	if err := ValidateKey(dstKey); err != nil {
		return err
	}
	src := fmt.Sprintf("%s/%s", strings.TrimRight(s.cfg.PublicBase, "/"), strings.TrimLeft(srcKey, "/"))
	_, _, err := s.client.Object.Copy(ctx, dstKey, src, nil)
	return err
}

func (s *tencentStorage) Head(ctx context.Context, key string) (bool, string, int64, time.Time, error) {
	if err := ValidateKey(key); err != nil {
		return false, "", 0, time.Time{}, err
	}
	resp, err := s.client.Object.Head(ctx, key, nil)
	if err != nil {
		if resp != nil && resp.StatusCode == http.StatusNotFound {
			return false, "", 0, time.Time{}, nil
		}
		return false, "", 0, time.Time{}, err
	}
	defer resp.Body.Close()
	sz, _ := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	lm, _ := http.ParseTime(resp.Header.Get("Last-Modified"))
	return true, resp.Header.Get("Content-Type"), sz, lm, nil
}

func (s *tencentStorage) List(ctx context.Context, prefix string, maxKeys int) ([]ObjectInfo, error) {
	if maxKeys <= 0 || maxKeys > 1000 {
		maxKeys = 100
	}
	res, _, err := s.client.Bucket.Get(ctx, &tencentcos.BucketGetOptions{Prefix: strings.TrimLeft(prefix, "/"), MaxKeys: maxKeys})
	if err != nil {
		return nil, err
	}
	out := make([]ObjectInfo, 0, len(res.Contents))
	for _, o := range res.Contents {
		lm, _ := time.Parse(time.RFC3339, o.LastModified)
		out = append(out, ObjectInfo{Key: o.Key, Size: int64(o.Size), LastModified: lm, ETag: strings.Trim(o.ETag, `"`)})
	}
	return out, nil
}

func (s *tencentStorage) GetObjectStream(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	if err := ValidateKey(key); err != nil {
		return nil, "", 0, err
	}
	resp, err := s.client.Object.Get(ctx, key, nil)
	if err != nil {
		return nil, "", 0, err
	}
	_, ct, n, _, _ := s.Head(ctx, key)
	return resp.Body, ct, n, nil
}

func (s *tencentStorage) SignedGetURL(ctx context.Context, key string, expire time.Duration) (string, error) {
	if err := ValidateKey(key); err != nil {
		return "", err
	}
	if expire <= 0 {
		expire = time.Hour
	}
	u, err := s.client.Object.GetPresignedURL(ctx, http.MethodGet, key, s.cfg.SecretID, s.cfg.SecretKey, expire, nil)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}
