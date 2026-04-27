package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"vino/backend/internal/config"
	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"
	"vino/backend/internal/services"

	"github.com/gin-gonic/gin"
)

var homeConfigSectionOrRoleRe = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_-]{0,63}$`)

var (
	errHCNoMultipart    = errors.New("解析上传表单失败")
	errHCInvalidSection = errors.New("无效的 section")
	errHCNoFile         = errors.New("请选择图片文件")
	errHCInvalidRole    = errors.New("无效的 role")
)

func resolveHomeConfigUpload(section string) (prefix string, flatLayout bool, err error) {
	s := strings.TrimSpace(section)
	if s == "" {
		// 未传 section 的上传使用通用目录：vino/uploads + 随机名 + thumb 子目录。
		return "vino/uploads", false, nil
	}
	switch s {
	case "tabbar":
		return "vino/main_page", false, nil
	case "splash", "headerLogo", "homeBg":
		return "vino/main_animation", false, nil
	default:
		if !homeConfigSectionOrRoleRe.MatchString(s) {
			return "", false, errHCInvalidSection
		}
		return "vino/main_page/" + s, true, nil
	}
}

func multipartFormString(c *gin.Context, key string) string {
	if c.Request.MultipartForm == nil || c.Request.MultipartForm.Value == nil {
		return ""
	}
	if v := c.Request.MultipartForm.Value[key]; len(v) > 0 {
		return strings.TrimSpace(v[0])
	}
	return ""
}

// homeConfigImageUpload randomPrefix：tabbar/动画区为 homeconfig- 或 outlet-homeconfig-；其余板块为 vino/main_page/{section}/{role}.*
func homeConfigImageUpload(c *gin.Context, randomPrefix string) (urlu, thumb string, err error) {
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		return "", "", errHCNoMultipart
	}
	sec := multipartFormString(c, "section")
	role := multipartFormString(c, "role")
	prefix, flat, err := resolveHomeConfigUpload(sec)
	if err != nil {
		return "", "", err
	}
	fh, err := c.FormFile("file")
	if err != nil {
		return "", "", errHCNoFile
	}
	f, err := fh.Open()
	if err != nil {
		return "", "", err
	}
	defer f.Close()
	buf, err := io.ReadAll(f)
	if err != nil {
		return "", "", err
	}
	ext := path.Ext(fh.Filename)
	ct := fh.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/png"
	}
	ctx := c.Request.Context()
	if !flat {
		if ext == "" {
			ext = ".png"
		}
		b := make([]byte, 4)
		_, _ = rand.Read(b)
		filename := randomPrefix + strconv.FormatInt(time.Now().UnixMilli(), 10) + "-" + hex.EncodeToString(b) + ext
		return services.UploadWithThumbWithContentPrefix(ctx, buf, filename, ct, 0, prefix)
	}
	if role == "" {
		role = "image"
	}
	if !homeConfigSectionOrRoleRe.MatchString(role) {
		return "", "", errHCInvalidRole
	}
	switch role {
	case "image", "image_en":
		thumbStem := "cover_thumbnail"
		if role == "image_en" {
			thumbStem = "cover_thumbnail_en"
		}
		return services.UploadOriginalAndFlatCoverThumb(ctx, buf, role, ext, ct, thumbStem, 0, prefix)
	case "cover_thumbnail", "cover_thumbnail_en":
		if ext == "" {
			ext = ".png"
		}
		filename := role + ext
		urlu, err = services.UploadCOSWithContentPrefix(ctx, buf, filename, ct, prefix)
		return urlu, "", err
	default:
		if ext == "" {
			ext = ".png"
		}
		filename := role + ext
		urlu, err = services.UploadCOSWithContentPrefix(ctx, buf, filename, ct, prefix)
		return urlu, "", err
	}
}

func fixHomeProxyURL(u string) string {
	if u == "" {
		return u
	}
	s := strings.TrimSpace(u)
	prefix := "/api/media/cos?key="
	if strings.HasPrefix(s, prefix) {
		key, err := url.QueryUnescape(s[len(prefix):])
		if err != nil {
			return s
		}
		return services.CosBase() + "/" + key
	}
	return s
}

func hcList(c *gin.Context) {
	q := db.DB.Model(&models.HomeConfig{})
	if sec := c.Query("section"); sec != "" {
		q = q.Where("section = ?", sec)
	}
	if c.Query("all") == "" {
		q = q.Where("status = ?", "active")
	}
	buildOut := func(items []models.HomeConfig) []gin.H {
		out := make([]gin.H, 0, len(items))
		for _, it := range items {
			raw, _ := json.Marshal(it)
			var o gin.H
			_ = json.Unmarshal(raw, &o)
			thumb := ""
			if x, ok := o["imageUrlThumb"].(string); ok {
				thumb = x
			}
			o["imageUrl"] = fixHomeProxyURL(it.ImageURL)
			o["imageUrlThumb"] = fixHomeProxyURL(strings.TrimSpace(thumb))
			out = append(out, o)
		}
		return out
	}
	// 管理端传 paged=1 时分页；ToC 等不传则保持原数组响应，避免首页/登录只拿到前 50 条。
	if c.Query("paged") != "1" {
		var items []models.HomeConfig
		if err := q.Order("section ASC, sortOrder ASC, id ASC").Find(&items).Error; err != nil {
			resp.Err(c, 500, 500, "查询失败")
			return
		}
		resp.OK(c, buildOut(items))
		return
	}
	page, pageSize := adminListPageParams(c)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		resp.Err(c, 500, 500, "统计失败")
		return
	}
	var items []models.HomeConfig
	offset := (page - 1) * pageSize
	if err := q.Order("section ASC, sortOrder ASC, id ASC").Limit(pageSize).Offset(offset).Find(&items).Error; err != nil {
		resp.Err(c, 500, 500, "查询失败")
		return
	}
	resp.OK(c, gin.H{"list": buildOut(items), "total": total, "page": page, "pageSize": pageSize})
}

func hcCreate(c *gin.Context) {
	var body models.HomeConfig
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	if err := db.DB.Create(&body).Error; err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	resp.OK(c, body)
}

func hcUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var item models.HomeConfig
	if err := db.DB.First(&item, id).Error; err != nil {
		resp.Err(c, 404, 1, "配置不存在")
		return
	}
	var patch map[string]interface{}
	if err := c.ShouldBindJSON(&patch); err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	raw, _ := json.Marshal(patch)
	_ = json.Unmarshal(raw, &item)
	item.ID = id
	if err := db.DB.Save(&item).Error; err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	resp.OK(c, item)
}

func hcRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := db.DB.Delete(&models.HomeConfig{}, id).Error; err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	resp.OKMsg(c, "删除成功")
}

func hcUploadImage(c *gin.Context, cfg *config.Config) {
	_ = cfg
	urlu, thumb, err := homeConfigImageUpload(c, "homeconfig-")
	if err != nil {
		if errors.Is(err, errHCNoMultipart) || errors.Is(err, errHCInvalidSection) || errors.Is(err, errHCNoFile) || errors.Is(err, errHCInvalidRole) {
			resp.Err(c, 400, 1, err.Error())
			return
		}
		resp.Err(c, 500, 1, err.Error())
		return
	}
	resp.OK(c, gin.H{"url": urlu, "thumbUrl": thumb})
}
