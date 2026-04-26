package handlers

import (
	"strconv"

	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"

	"github.com/gin-gonic/gin"
)

func scatList(c *gin.Context) {
	page, pageSize := adminListPageParams(c)
	qb := db.DB.Model(&models.ServiceCategory{})
	var total int64
	if err := qb.Count(&total).Error; err != nil {
		resp.Err(c, 500, 500, "统计失败")
		return
	}
	var list []models.ServiceCategory
	offset := (page - 1) * pageSize
	if err := db.DB.Order("sortOrder ASC, id ASC").Limit(pageSize).Offset(offset).Find(&list).Error; err != nil {
		resp.Err(c, 500, 500, "查询失败")
		return
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func scatCreate(c *gin.Context) {
	var body models.ServiceCategory
	if err := c.ShouldBindJSON(&body); err != nil || body.Name == "" {
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

func scatUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cat models.ServiceCategory
	if err := db.DB.First(&cat, id).Error; err != nil {
		resp.Err(c, 404, 404, "种类不存在")
		return
	}
	var body models.ServiceCategory
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if body.Name != "" {
		cat.Name = body.Name
	}
	if body.NameEn != "" {
		cat.NameEn = body.NameEn
	}
	if body.Key != nil {
		cat.Key = body.Key
	}
	cat.SortOrder = body.SortOrder
	if body.Status != "" {
		cat.Status = body.Status
	}
	if body.Bg != nil {
		cat.Bg = body.Bg
	}
	cat.BgOpacity = body.BgOpacity
	if err := db.DB.Save(&cat).Error; err != nil {
		resp.Err(c, 500, 500, "更新失败")
		return
	}
	resp.OK(c, cat)
}

func scatRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cat models.ServiceCategory
	if err := db.DB.First(&cat, id).Error; err != nil {
		resp.Err(c, 404, 404, "种类不存在")
		return
	}
	var n int64
	db.DB.Model(&models.Service{}).Where("categoryId = ?", cat.ID).Count(&n)
	if n > 0 {
		resp.Err(c, 400, 400, "该种类下还有具体服务，请先删除或移出后再删种类")
		return
	}
	db.DB.Delete(&cat)
	resp.OKMsg(c, "删除成功")
}
