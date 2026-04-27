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
	page, pageSize := adminListPageParams(c)
	qb := db.DB.Model(&models.DeviceGuide{})
	var total int64
	if err := qb.Count(&total).Error; err != nil {
		resp.Err(c, 500, 500, "统计失败")
		return
	}
	var guides []models.DeviceGuide
	offset := (page - 1) * pageSize
	if err := db.DB.Preload("Category").Order("sortOrder ASC, id ASC").Limit(pageSize).Offset(offset).Find(&guides).Error; err != nil {
		resp.Err(c, 500, 500, "查询失败")
		return
	}
	out := make([]gin.H, 0, len(guides))
	for i := range guides {
		out = append(out, attachGuideThumbs(&guides[i]))
	}
	resp.OK(c, gin.H{"list": out, "total": total, "page": page, "pageSize": pageSize})
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
	// 清空预加载/合并后的关联，避免 GORM Save 时写关联表或外键异常；仅更新 device_guides 行
	guide.Category = nil
	if err := db.DB.Omit("Category").Save(&guide).Error; err != nil {
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
	productID := 0
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
				contentPrefix = fmt.Sprintf("front_page_config/product/%d", gid)
				productID = gid
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
	isProductPrefix := strings.HasPrefix(contentPrefix, "front_page_config/product/")
	isIconUpload := isProductPrefix && strings.HasPrefix(ct, "image/") && (assetKind == "icon" || assetKind == "icon_en")
	isCoverPair := isProductPrefix && strings.HasPrefix(ct, "image/") && (assetKind == "cover" || assetKind == "cover_en")
	isCoverThumbOnly := isProductPrefix && strings.HasPrefix(ct, "image/") && (assetKind == "cover_thumb" || assetKind == "cover_thumb_en")
	isModel3D := isProductPrefix && (assetKind == "model3d" || assetKind == "model3d_decal" || assetKind == "model3d_skybox")
	isDescriptionPDF := isProductPrefix && assetKind == "description" && (strings.Contains(strings.ToLower(ct), "pdf") || strings.EqualFold(ext, ".pdf"))
	ctx := c.Request.Context()
	// 3D 预览资源：GLB + 贴花图 + 环境图；文件名固定以便去重覆盖，走无缩略图直传。
	if isDescriptionPDF {
		filename = "description.pdf"
		ct = "application/pdf"
		url, err := services.UploadCOSWithContentPrefix(ctx, buf, filename, ct, contentPrefix)
		if err != nil {
			resp.Err(c, 500, 500, "上传失败: "+err.Error())
			return
		}
		resp.OK(c, gin.H{"url": url, "thumbUrl": nil})
		return
	}
	if isModel3D {
		switch assetKind {
		case "model3d":
			filename = "model3d.glb"
			if ct == "" || ct == "application/octet-stream" {
				ct = "model/gltf-binary"
			}
		case "model3d_decal":
			ext = ".png"
			filename = "decal.png"
			if ct == "" || ct == "application/octet-stream" {
				ct = "image/png"
			}
		case "model3d_skybox":
			if ext == "" || ext == ".bin" {
				ext = ".jpg"
			}
			if !strings.EqualFold(ext, ".jpg") && !strings.EqualFold(ext, ".jpeg") {
				ext = ".jpg"
			}
			filename = "model3d_skybox" + ext
			if ct == "" || strings.HasPrefix(ct, "image/") == false {
				ct = "image/jpeg"
			}
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
			if productID <= 0 {
				resp.Err(c, 400, 400, "非法 guideId")
				return
			}
			lang := "zh"
			if assetKind == "icon_en" {
				lang = "en"
			}
			extLower := strings.ToLower(ext)
			ctLower := strings.ToLower(ct)
			if extLower != ".jpg" && extLower != ".jpeg" && !strings.Contains(ctLower, "jpeg") && !strings.Contains(ctLower, "jpg") {
				resp.Err(c, 400, 400, "仅支持 JPG 图片")
				return
			}
			fullKey, err := services.FrontPageProductIconKey(productID, lang)
			if err != nil {
				resp.Err(c, 500, 500, "上传失败: "+err.Error())
				return
			}
			cp, file := services.ContentPrefixAndFileFromKey(fullKey)
			if cp == "" || file == "" {
				resp.Err(c, 500, 500, "上传失败: 商品图标模板非法")
				return
			}
			url, err := services.UploadCOSWithContentPrefix(ctx, buf, file, "image/jpeg", cp)
			if err != nil {
				resp.Err(c, 500, 500, "上传失败: "+err.Error())
				return
			}
			resp.OK(c, gin.H{"url": url, "thumbUrl": nil})
			return
		}
		if isCoverPair {
			if productID <= 0 {
				resp.Err(c, 400, 400, "非法 guideId")
				return
			}
			lang := "zh"
			if assetKind == "cover_en" {
				lang = "en"
			}
			extLower := strings.ToLower(ext)
			ctLower := strings.ToLower(ct)
			if extLower != ".jpg" && extLower != ".jpeg" && !strings.Contains(ctLower, "jpeg") && !strings.Contains(ctLower, "jpg") {
				resp.Err(c, 400, 400, "仅支持 JPG 图片")
				return
			}
			coverKey, err := services.FrontPageProductCoverKey(productID, lang)
			if err != nil {
				resp.Err(c, 500, 500, "上传失败: "+err.Error())
				return
			}
			thumbKey, err := services.FrontPageProductCoverThumbKey(productID, lang)
			if err != nil {
				resp.Err(c, 500, 500, "上传失败: "+err.Error())
				return
			}
			coverPrefix, coverFile := services.ContentPrefixAndFileFromKey(coverKey)
			thumbPrefix, thumbFile := services.ContentPrefixAndFileFromKey(thumbKey)
			if coverPrefix == "" || coverFile == "" || thumbPrefix == "" || thumbFile == "" {
				resp.Err(c, 500, 500, "上传失败: 商品封面模板非法")
				return
			}
			url, err := services.UploadCOSWithContentPrefix(ctx, buf, coverFile, "image/jpeg", coverPrefix)
			if err != nil {
				resp.Err(c, 500, 500, "上传失败: "+err.Error())
				return
			}
			tb, _ := services.GenerateThumbBuffer(buf, "image/jpeg")
			thumbURL := ""
			if len(tb) > 0 {
				thumbURL, _ = services.UploadCOSWithContentPrefix(ctx, tb, thumbFile, "image/jpeg", thumbPrefix)
			}
			resp.OK(c, gin.H{"url": url, "thumbUrl": thumbURL})
			return
		}
		if isCoverThumbOnly {
			if productID <= 0 {
				resp.Err(c, 400, 400, "非法 guideId")
				return
			}
			lang := "zh"
			if assetKind == "cover_thumb_en" {
				lang = "en"
			}
			extLower := strings.ToLower(ext)
			ctLower := strings.ToLower(ct)
			if extLower != ".jpg" && extLower != ".jpeg" && !strings.Contains(ctLower, "jpeg") && !strings.Contains(ctLower, "jpg") {
				resp.Err(c, 400, 400, "仅支持 JPG 图片")
				return
			}
			thumbKey, err := services.FrontPageProductCoverThumbKey(productID, lang)
			if err != nil {
				resp.Err(c, 500, 500, "上传失败: "+err.Error())
				return
			}
			cp, file := services.ContentPrefixAndFileFromKey(thumbKey)
			if cp == "" || file == "" {
				resp.Err(c, 500, 500, "上传失败: 商品缩略图模板非法")
				return
			}
			url, err := services.UploadCOSWithContentPrefix(ctx, buf, file, "image/jpeg", cp)
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
	goodsPrefix := fmt.Sprintf("front_page_config/product/%d", guide.ID)
	url, err := services.UploadCOSWithContentPrefix(c.Request.Context(), png, filename, "image/png", goodsPrefix)
	if err != nil {
		resp.Err(c, 500, 1, "生成失败: "+err.Error())
		return
	}
	_ = db.DB.Model(&guide).Update("qrcodeUrl", url).Error
	resp.OK(c, gin.H{"url": url})
}
