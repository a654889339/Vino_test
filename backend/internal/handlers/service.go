package handlers

import (
	"encoding/json"
	"log"
	"strconv"
	"strings"

	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"

	"github.com/gin-gonic/gin"
)

func svcList(c *gin.Context) {
	q := db.DB.Model(&models.Service{}).Where("services.status = ?", "active").
		Joins("INNER JOIN service_categories sc ON sc.id = services.categoryId AND sc.status = ?", "active")
	if cid := strings.TrimSpace(c.Query("categoryId")); cid != "" {
		if id, err := strconv.Atoi(cid); err == nil {
			q = q.Where("services.categoryId = ?", id)
		}
	}
	var rows []models.Service
	q.Preload("ServiceCategory").Order("sc.sortOrder ASC, services.sortOrder ASC, services.id ASC").Find(&rows)
	resp.OK(c, gin.H{"list": rows})
}

func svcDetail(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		resp.Err(c, 400, 400, "无效的服务ID")
		return
	}
	var s models.Service
	if err := db.DB.Preload("ServiceCategory").First(&s, id).Error; err != nil {
		resp.Err(c, 404, 404, "服务不存在")
		return
	}
	resp.OK(c, s)
}

func svcAdminList(c *gin.Context) {
	var rows []models.Service
	db.DB.Model(&models.Service{}).Preload("ServiceCategory").
		Joins("LEFT JOIN service_categories sc ON sc.id = services.categoryId").
		Order("sc.sortOrder ASC, services.sortOrder ASC, services.id ASC").
		Find(&rows)
	resp.OK(c, rows)
}

func svcCreate(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	raw, _ := json.Marshal(body)
	var s models.Service
	_ = json.Unmarshal(raw, &s)
	if strings.TrimSpace(s.Title) == "" {
		resp.Err(c, 400, 400, "标题不能为空")
		return
	}
	if s.CategoryID == nil && (s.Category == nil || strings.TrimSpace(*s.Category) == "") {
		resp.Err(c, 400, 400, "请选择服务种类")
		return
	}
	// 校验 categoryId 对应的种类必须存在，避免撞到 services_ibfk_1 外键约束导致的 MySQL 1452，
	// 并把 Category 冗余字段同步为种类的 key/Name，便于旧前端（按 category 字符串过滤）继续工作。
	if s.CategoryID != nil {
		var cat models.ServiceCategory
		if err := db.DB.First(&cat, *s.CategoryID).Error; err != nil {
			resp.Err(c, 400, 400, "所选服务种类不存在或已删除")
			return
		}
		if s.Category == nil || strings.TrimSpace(*s.Category) == "" {
			if cat.Key != nil && strings.TrimSpace(*cat.Key) != "" {
				k := *cat.Key
				s.Category = &k
			} else if cat.Name != "" {
				n := cat.Name
				s.Category = &n
			}
		}
	}
	if s.Status == "" {
		s.Status = "active"
	}
	if err := db.DB.Create(&s).Error; err != nil {
		// 把底层错误打进后端日志，便于现场排障；对外仍返回可读 message。
		log.Printf("[svcCreate] db.Create failed: body=%s err=%v", string(raw), err)
		resp.Err(c, 500, 500, "创建服务失败: "+err.Error())
		return
	}
	db.DB.Preload("ServiceCategory").First(&s, s.ID)
	resp.OK(c, s)
}

func svcUpdate(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		resp.Err(c, 400, 400, "无效的服务ID")
		return
	}
	var s models.Service
	if err := db.DB.First(&s, id).Error; err != nil {
		resp.Err(c, 404, 404, "服务不存在")
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	raw, _ := json.Marshal(body)
	_ = json.Unmarshal(raw, &s)
	if s.CategoryID != nil {
		var cat models.ServiceCategory
		if err := db.DB.First(&cat, *s.CategoryID).Error; err != nil {
			resp.Err(c, 400, 400, "所选服务种类不存在或已删除")
			return
		}
	}
	if err := db.DB.Save(&s).Error; err != nil {
		log.Printf("[svcUpdate] db.Save failed: id=%d body=%s err=%v", id, string(raw), err)
		resp.Err(c, 500, 500, "更新服务失败: "+err.Error())
		return
	}
	db.DB.Preload("ServiceCategory").First(&s, s.ID)
	resp.OK(c, s)
}

func svcRemove(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		resp.Err(c, 400, 400, "无效的服务ID")
		return
	}
	if err := db.DB.Delete(&models.Service{}, id).Error; err != nil {
		resp.Err(c, 500, 500, "删除服务失败")
		return
	}
	resp.OKMsg(c, "删除成功")
}
