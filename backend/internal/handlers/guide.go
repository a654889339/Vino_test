package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
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
	qrcodegen "github.com/skip2/go-qrcode"
)

var guideIDNumeric = regexp.MustCompile(`^\d+$`)

func guideCategories(c *gin.Context) {
	var list []models.ProductCategory
	db.DB.Where("status = ?", "active").Order("sortOrder ASC, id ASC").
		Select("id", "name", "nameEn", "sortOrder", "thumbnail_url", "thumbnailUrlEn").Find(&list)
	resp.OK(c, list)
}

func guideList(c *gin.Context) {
	q := db.DB.Model(&models.DeviceGuide{}).Where("status = ?", "active")
	if cid := strings.TrimSpace(c.Query("categoryId")); cid != "" {
		if id, err := strconv.Atoi(cid); err == nil {
			q = q.Where("categoryId = ? OR categoryId IS NULL", id)
		}
	}
	var guides []models.DeviceGuide
	q.Order("sortOrder ASC, id ASC").Find(&guides)
	out := make([]gin.H, 0, len(guides))
	for i := range guides {
		out = append(out, attachGuideThumbs(&guides[i]))
	}
	resp.OK(c, out)
}

func attachGuideThumbs(g *models.DeviceGuide) gin.H {
	raw, _ := json.Marshal(g)
	var h gin.H
	_ = json.Unmarshal(raw, &h)
	// 商品图标不再使用/推导 iconUrlThumb，仅返回库中已有值（管理端保存时清空）
	iconThumb := strings.TrimSpace(g.IconURLThumb)
	coverThumb := strings.TrimSpace(g.CoverImageThumb)
	if coverThumb == "" && g.CoverImage != "" {
		coverThumb = services.GetThumbURL(g.CoverImage)
	}
	h["iconUrlThumb"] = iconThumb
	h["coverImageThumb"] = coverThumb
	h["qrcodeUrlThumb"] = services.GetThumbURL(g.QrcodeURL)
	return h
}

func guideDetail(c *gin.Context) {
	param := c.Param("id")
	var g models.DeviceGuide
	var err error
	if guideIDNumeric.MatchString(param) {
		err = db.DB.First(&g, param).Error
	} else {
		err = db.DB.Where("slug = ?", param).First(&g).Error
	}
	if err != nil {
		resp.Err(c, 404, 404, "不存在")
		return
	}
	resp.OK(c, attachGuideThumbs(&g))
}

func guideAdminList(c *gin.Context) {
	var guides []models.DeviceGuide
	db.DB.Preload("Category").Order("sortOrder ASC, id ASC").Find(&guides)
	out := make([]gin.H, 0, len(guides))
	for i := range guides {
		out = append(out, attachGuideThumbs(&guides[i]))
	}
	resp.OK(c, out)
}

func guideCreate(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	name, _ := body["name"].(string)
	slug, _ := body["slug"].(string)
	if strings.TrimSpace(name) == "" {
		resp.Err(c, 400, 400, "名称不能为空")
		return
	}
	if strings.TrimSpace(slug) == "" {
		resp.Err(c, 400, 400, "英文描述不能为空")
		return
	}
	var n int64
	db.DB.Model(&models.DeviceGuide{}).Where("slug = ?", strings.TrimSpace(slug)).Count(&n)
	if n > 0 {
		resp.Err(c, 400, 400, "英文描述 \""+slug+"\" 已被使用")
		return
	}
	raw, _ := json.Marshal(body)
	var g models.DeviceGuide
	if err := json.Unmarshal(raw, &g); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if err := db.DB.Create(&g).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OK(c, g)
}

func guideUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var guide models.DeviceGuide
	if err := db.DB.First(&guide, id).Error; err != nil {
		resp.Err(c, 404, 404, "不存在")
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if slug, ok := body["slug"].(string); ok && strings.TrimSpace(slug) != "" {
		var n int64
		db.DB.Model(&models.DeviceGuide{}).Where("slug = ? AND id <> ?", strings.TrimSpace(slug), id).Count(&n)
		if n > 0 {
			resp.Err(c, 400, 400, "英文描述 \""+slug+"\" 已被使用")
			return
		}
	}
	raw, _ := json.Marshal(body)
	_ = json.Unmarshal(raw, &guide)
	if err := db.DB.Save(&guide).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OK(c, guide)
}

func guideRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := db.DB.Delete(&models.DeviceGuide{}, id).Error; err != nil {
		resp.Err(c, 500, 500, "删除失败")
		return
	}
	resp.OKMsg(c, "删除成功")
}

func guideUploadFile(c *gin.Context, cfg *config.Config) {
	_ = cfg
	// 必须先完整解析 multipart，再从 MultipartForm 取 guideId；若先取 file 再 PostForm，部分环境下 guideId 为空，导致始终落到 vino/uploads
	if err := c.Request.ParseMultipartForm(64 << 20); err != nil {
		resp.Err(c, 400, 400, "解析上传表单失败")
		return
	}
	gidStr := ""
	assetKind := ""
	if c.Request.MultipartForm != nil && c.Request.MultipartForm.Value != nil {
		if v := c.Request.MultipartForm.Value["guideId"]; len(v) > 0 {
			gidStr = strings.TrimSpace(v[0])
		}
		if v := c.Request.MultipartForm.Value["assetKind"]; len(v) > 0 {
			assetKind = strings.TrimSpace(v[0])
		}
	}
	contentPrefix := "vino/uploads"
	if gidStr != "" {
		if gid, err := strconv.Atoi(gidStr); err == nil && gid > 0 {
			var g models.DeviceGuide
			if err := db.DB.Select("id").First(&g, gid).Error; err == nil {
				contentPrefix = fmt.Sprintf("vino/items/goods/%d", gid)
			}
		}
	}
	fh, err := c.FormFile("file")
	if err != nil {
		resp.Err(c, 400, 400, "未选择文件")
		return
	}
	f, err := fh.Open()
	if err != nil {
		resp.Err(c, 500, 500, "读取失败")
		return
	}
	defer f.Close()
	buf, err := io.ReadAll(f)
	if err != nil {
		resp.Err(c, 500, 500, "读取失败")
		return
	}
	ext := path.Ext(fh.Filename)
	if ext == "" {
		ext = ".bin"
	}
	filename := "guide-" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "-" + randomHex(6) + ext
	ct := fh.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}
	isGoodsPrefix := strings.HasPrefix(contentPrefix, "vino/items/goods/")
	isIconUpload := isGoodsPrefix && strings.HasPrefix(ct, "image/") && (assetKind == "icon" || assetKind == "icon_en")
	isCoverPair := isGoodsPrefix && strings.HasPrefix(ct, "image/") && (assetKind == "cover" || assetKind == "cover_en")
	isCoverThumbOnly := isGoodsPrefix && strings.HasPrefix(ct, "image/") && (assetKind == "cover_thumb" || assetKind == "cover_thumb_en")
	isModel3D := isGoodsPrefix && (assetKind == "model3d" || assetKind == "model3d_decal" || assetKind == "model3d_skybox")
	if isIconUpload {
		if ext == ".bin" {
			ext = ".png"
		}
		if assetKind == "icon_en" {
			filename = "icon_en" + ext
		} else {
			filename = "icon" + ext
		}
	}
	ctx := c.Request.Context()
	// 3D 预览资源：GLB + 贴花图 + 环境图；文件名固定以便去重覆盖，走无缩略图直传。
	if isModel3D {
		switch assetKind {
		case "model3d":
			filename = "model3d.glb"
			if ct == "" || ct == "application/octet-stream" {
				ct = "model/gltf-binary"
			}
		case "model3d_decal":
			if ext == "" || ext == ".bin" {
				ext = ".png"
			}
			filename = "model3d_decal" + ext
		case "model3d_skybox":
			if ext == "" || ext == ".bin" {
				ext = ".png"
			}
			filename = "model3d_skybox" + ext
		}
		url, err := services.UploadCOSWithContentPrefix(ctx, buf, filename, ct, contentPrefix)
		if err != nil {
			resp.Err(c, 500, 500, "上传失败: "+err.Error())
			return
		}
		resp.OK(c, gin.H{"url": url, "thumbUrl": nil})
		return
	}
	if strings.HasPrefix(ct, "image/") {
		if isIconUpload {
			url, err := services.UploadCOSWithContentPrefix(ctx, buf, filename, ct, contentPrefix)
			if err != nil {
				resp.Err(c, 500, 500, "上传失败: "+err.Error())
				return
			}
			resp.OK(c, gin.H{"url": url, "thumbUrl": nil})
			return
		}
		if isCoverPair {
			origStem := "large_image"
			thumbStem := "cover_thumbnail"
			if assetKind == "cover_en" {
				origStem = "large_image_en"
				thumbStem = "cover_thumbnail_en"
			}
			url, thumb, err := services.UploadOriginalAndFlatCoverThumb(ctx, buf, origStem, ext, ct, thumbStem, 0, contentPrefix)
			if err != nil {
				resp.Err(c, 500, 500, "上传失败: "+err.Error())
				return
			}
			resp.OK(c, gin.H{"url": url, "thumbUrl": thumb})
			return
		}
		if isCoverThumbOnly {
			stem := "cover_thumbnail"
			if assetKind == "cover_thumb_en" {
				stem = "cover_thumbnail_en"
			}
			if ext == "" || ext == ".bin" {
				ext = ".png"
			}
			fn := stem + ext
			url, err := services.UploadCOSWithContentPrefix(ctx, buf, fn, ct, contentPrefix)
			if err != nil {
				resp.Err(c, 500, 500, "上传失败: "+err.Error())
				return
			}
			resp.OK(c, gin.H{"url": url, "thumbUrl": nil})
			return
		}
		url, thumb, err := services.UploadWithThumbWithContentPrefix(ctx, buf, filename, ct, 0, contentPrefix)
		if err != nil {
			resp.Err(c, 500, 500, "上传失败: "+err.Error())
			return
		}
		resp.OK(c, gin.H{"url": url, "thumbUrl": thumb})
		return
	}
	url, err := services.UploadCOSWithContentPrefix(ctx, buf, filename, ct, contentPrefix)
	if err != nil {
		resp.Err(c, 500, 500, "上传失败: "+err.Error())
		return
	}
	resp.OK(c, gin.H{"url": url, "thumbUrl": nil})
}

func randomHex(n int) string {
	b := make([]byte, (n+1)/2)
	_, _ = rand.Read(b)
	h := hex.EncodeToString(b)
	if len(h) > n {
		return h[:n]
	}
	return h
}

func guideGenerateQR(c *gin.Context, cfg *config.Config) {
	id, _ := strconv.Atoi(c.Param("id"))
	var guide models.DeviceGuide
	if err := db.DB.First(&guide, id).Error; err != nil {
		resp.Err(c, 404, 1, "商品不存在")
		return
	}
	var body struct {
		Force bool `json:"force"`
	}
	_ = c.ShouldBindJSON(&body)
	if guide.QrcodeURL != "" && !body.Force {
		resp.OK(c, gin.H{"url": guide.QrcodeURL})
		return
	}
	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = cfg.FrontendURL
	}
	pagePath := strconv.Itoa(guide.ID)
	if guide.Slug != nil && strings.TrimSpace(*guide.Slug) != "" {
		pagePath = strings.TrimSpace(*guide.Slug)
	}
	page := base + "/guide/" + pagePath
	png, err := qrcodegen.Encode(page, qrcodegen.Medium, 400)
	if err != nil {
		resp.Err(c, 500, 1, "生成失败: "+err.Error())
		return
	}
	filename := "scan.png"
	goodsPrefix := fmt.Sprintf("vino/items/goods/%d", guide.ID)
	url, err := services.UploadCOSWithContentPrefix(c.Request.Context(), png, filename, "image/png", goodsPrefix)
	if err != nil {
		resp.Err(c, 500, 1, "生成失败: "+err.Error())
		return
	}
	_ = db.DB.Model(&guide).Update("qrcodeUrl", url).Error
	resp.OK(c, gin.H{"url": url})
}
