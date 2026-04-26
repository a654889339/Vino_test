package handlers

import (
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"

	"vino/backend/internal/config"
	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"
	"vino/backend/internal/services"

	"github.com/gin-gonic/gin"
)

func pcList(c *gin.Context) {
	page, pageSize := adminListPageParams(c)
	qb := db.DB.Model(&models.ProductCategory{})
	var total int64
	if err := qb.Count(&total).Error; err != nil {
		resp.Err(c, 500, 500, "统计失败")
		return
	}
	var list []models.ProductCategory
	offset := (page - 1) * pageSize
	if err := db.DB.Order("sortOrder ASC, id ASC").Limit(pageSize).Offset(offset).Find(&list).Error; err != nil {
		resp.Err(c, 500, 500, "查询失败")
		return
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func pcCreate(c *gin.Context) {
	var body models.ProductCategory
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		resp.Err(c, 400, 400, "种类名称不能为空")
		return
	}
	if body.Status == "" {
		body.Status = "active"
	}
	if err := db.DB.Create(&body).Error; err != nil {
		resp.Err(c, 500, 500, "创建失败")
		return
	}
	resp.OK(c, body)
}

func pcUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cat models.ProductCategory
	if err := db.DB.First(&cat, id).Error; err != nil {
		resp.Err(c, 404, 404, "种类不存在")
		return
	}
	var body models.ProductCategory
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if body.Name != "" {
		cat.Name = strings.TrimSpace(body.Name)
	}
	cat.NameEn = body.NameEn
	if body.ThumbnailURL != nil {
		cat.ThumbnailURL = body.ThumbnailURL
	}
	if body.ThumbnailURLEn != nil {
		cat.ThumbnailURLEn = body.ThumbnailURLEn
	}
	cat.SortOrder = body.SortOrder
	if body.Status != "" {
		cat.Status = body.Status
	}
	if err := db.DB.Save(&cat).Error; err != nil {
		resp.Err(c, 500, 500, "更新失败")
		return
	}
	resp.OK(c, cat)
}

func pcRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := db.DB.Delete(&models.ProductCategory{}, id).Error; err != nil {
		resp.Err(c, 500, 500, "删除失败")
		return
	}
	resp.OKMsg(c, "删除成功")
}

func pcUploadImage(c *gin.Context, cfg *config.Config) {
	_ = cfg
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		resp.Err(c, 400, 400, "解析上传表单失败")
		return
	}
	cidStr := ""
	if c.Request.MultipartForm != nil && c.Request.MultipartForm.Value != nil {
		if v := c.Request.MultipartForm.Value["categoryId"]; len(v) > 0 {
			cidStr = strings.TrimSpace(v[0])
		}
	}
	cid, err := strconv.Atoi(cidStr)
	if err != nil || cid <= 0 {
		resp.Err(c, 400, 400, "请提供有效 categoryId（请先保存种类）")
		return
	}
	var cat models.ProductCategory
	if err := db.DB.First(&cat, cid).Error; err != nil {
		resp.Err(c, 404, 404, "种类不存在")
		return
	}
	fh, err := c.FormFile("file")
	if err != nil {
		resp.Err(c, 400, 400, "请选择图片文件")
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
		ext = ".png"
	}
	ct := fh.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/png"
	}
	prefix := fmt.Sprintf("vino/items/type/%d", cid)
	urlu, thumb, err := services.UploadOriginalAndFlatCoverThumb(c.Request.Context(), buf, "large_image", ext, ct, "cover_thumbnail", 0, prefix)
	if err != nil {
		resp.Err(c, 500, 500, "上传失败: "+err.Error())
		return
	}
	resp.OK(c, gin.H{"url": urlu, "thumbUrl": thumb})
}
