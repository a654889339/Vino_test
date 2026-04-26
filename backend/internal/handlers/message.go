package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"path"
	"strconv"
	"strings"
	"time"

	"vino/backend/internal/config"
	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"
	"vino/backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func msgMy(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var list []models.Message
	db.DB.Where("userId = ?", u.ID).Order("createdAt ASC").Find(&list)
	db.DB.Model(&models.Message{}).Where("userId = ? AND sender = ? AND `read` = ?", u.ID, "admin", false).Update("read", true)
	resp.OK(c, list)
}

func msgSend(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body struct {
		Content string `json:"content"`
		Type    string `json:"type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Content) == "" {
		resp.Err(c, 400, 1, "消息不能为空")
		return
	}
	t := "text"
	if body.Type == "image" {
		t = "image"
	}
	m := models.Message{UserID: u.ID, Sender: "user", Content: strings.TrimSpace(body.Content), Type: t}
	db.DB.Create(&m)
	resp.OK(c, m)
}

func msgUploadImage(c *gin.Context, cfg *config.Config) {
	_ = cfg
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	fh, err := c.FormFile("image")
	if err != nil {
		resp.Err(c, 400, 1, "请选择图片")
		return
	}
	f, err := fh.Open()
	if err != nil {
		resp.Err(c, 500, 1, "上传失败")
		return
	}
	defer f.Close()
	buf, err := io.ReadAll(f)
	if err != nil {
		resp.Err(c, 500, 1, "上传失败")
		return
	}
	ext := path.Ext(fh.Filename)
	if ext == "" {
		ext = ".png"
	}
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	filename := "chat_" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "_" + hex.EncodeToString(b) + ext
	ct := fh.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/png"
	}
	url, err := services.UploadCOS(c.Request.Context(), buf, filename, ct)
	if err != nil {
		resp.Err(c, 500, 1, "上传失败")
		return
	}
	_ = u
	resp.OK(c, gin.H{"url": url})
}

func msgUnread(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var n int64
	db.DB.Model(&models.Message{}).Where("userId = ? AND sender = ? AND `read` = ?", u.ID, "admin", false).Count(&n)
	resp.OK(c, n)
}

func msgAdminConversations(c *gin.Context) {
	page, pageSize := adminListPageParams(c)
	var total int64
	if err := db.DB.Raw("SELECT COUNT(*) FROM (SELECT DISTINCT userId FROM messages) AS d").Scan(&total).Error; err != nil {
		resp.Err(c, 500, 500, "统计失败")
		return
	}
	type uidRow struct {
		UserID int `gorm:"column:userId"`
	}
	var uidRows []uidRow
	offset := (page - 1) * pageSize
	if err := db.DB.Raw(`
SELECT userId FROM (
  SELECT userId, MAX(createdAt) AS mx FROM messages GROUP BY userId
) x ORDER BY x.mx DESC LIMIT ? OFFSET ?
`, pageSize, offset).Scan(&uidRows).Error; err != nil {
		resp.Err(c, 500, 500, "查询失败")
		return
	}
	type row struct {
		UserID int `gorm:"column:userId"`
		Cnt    int `gorm:"column:cnt"`
	}
	var unreadRows []row
	_ = db.DB.Model(&models.Message{}).Select("userId, COUNT(id) as cnt").Where("sender = ? AND `read` = ?", "user", false).Group("userId").Scan(&unreadRows).Error
	unread := map[int]int{}
	for _, r := range unreadRows {
		unread[r.UserID] = r.Cnt
	}
	out := make([]gin.H, 0, len(uidRows))
	for _, ur := range uidRows {
		var u models.User
		if err := db.DB.Select("id", "username", "nickname", "avatar").First(&u, ur.UserID).Error; err != nil {
			continue
		}
		var last models.Message
		if err := db.DB.Where("userId = ?", ur.UserID).Order("createdAt DESC, id DESC").First(&last).Error; err != nil {
			continue
		}
		nick := u.Nickname
		if nick == "" {
			nick = u.Username
		}
		out = append(out, gin.H{
			"userId": u.ID, "username": u.Username, "nickname": nick, "avatar": u.Avatar,
			"lastMessage": last.Content, "lastTime": last.CreatedAt, "lastSender": last.Sender, "lastType": last.Type,
			"unread": unread[u.ID],
		})
	}
	resp.OK(c, gin.H{"list": out, "total": total, "page": page, "pageSize": pageSize})
}

func msgAdminGet(c *gin.Context) {
	userID, _ := strconv.Atoi(c.Param("userId"))
	page, pageSize := adminListPageParams(c)
	var total int64
	db.DB.Model(&models.Message{}).Where("userId = ?", userID).Count(&total)
	var list []models.Message
	offset := (page - 1) * pageSize
	db.DB.Where("userId = ?", userID).Order("createdAt ASC").Limit(pageSize).Offset(offset).Find(&list)
	db.DB.Model(&models.Message{}).Where("userId = ? AND sender = ? AND `read` = ?", userID, "user", false).Update("read", true)
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func msgAdminReply(c *gin.Context) {
	userID, _ := strconv.Atoi(c.Param("userId"))
	var body struct {
		Content string `json:"content"`
		Type    string `json:"type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Content) == "" {
		resp.Err(c, 400, 1, "消息不能为空")
		return
	}
	t := "text"
	if body.Type == "image" {
		t = "image"
	}
	m := models.Message{UserID: userID, Sender: "admin", Content: strings.TrimSpace(body.Content), Type: t}
	db.DB.Create(&m)
	resp.OK(c, m)
}
