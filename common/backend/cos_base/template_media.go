package cosbase

import (
	"fmt"
	"path"
	"strings"
)

func imageContentTypeFromExt(ext string) (string, bool) {
	e := strings.ToLower(strings.TrimSpace(ext))
	if e == "" {
		return "", false
	}
	if !strings.HasPrefix(e, ".") {
		e = "." + e
	}
	switch e {
	case ".jpg", ".jpeg":
		return "image/jpeg", true
	case ".png":
		return "image/png", true
	case ".webp":
		return "image/webp", true
	default:
		return "", false
	}
}

// ImageContentTypeFromKey derives Content-Type from object key extension.
// Supported: .jpg/.jpeg, .png, .webp
func ImageContentTypeFromKey(key string) (string, error) {
	ext := path.Ext(strings.TrimSpace(key))
	ct, ok := imageContentTypeFromExt(ext)
	if !ok {
		return "", fmt.Errorf("不支持的图片扩展名: %s", ext)
	}
	return ct, nil
}

// ValidateUploadMatchesKey validates that the uploaded file matches the target key's extension.
// If neither filename extension nor upload content-type matches, returns an error.
func ValidateUploadMatchesKey(targetKey, uploadFilename, uploadContentType string) error {
	wantExt := strings.ToLower(path.Ext(strings.TrimSpace(targetKey)))
	if wantExt == "" {
		return fmt.Errorf("目标文件缺少扩展名")
	}
	wantCT, ok := imageContentTypeFromExt(wantExt)
	if !ok {
		return fmt.Errorf("目标扩展名不支持: %s", wantExt)
	}

	ext := strings.ToLower(path.Ext(strings.TrimSpace(uploadFilename)))
	ct := strings.ToLower(strings.TrimSpace(uploadContentType))

	extOK := ext != "" && (ext == wantExt || (wantExt == ".jpg" && ext == ".jpeg") || (wantExt == ".jpeg" && ext == ".jpg"))
	ctOK := ct != "" && ct == wantCT
	if !extOK && !ctOK {
		return fmt.Errorf("仅支持 %s", strings.TrimPrefix(wantExt, "."))
	}
	return nil
}

