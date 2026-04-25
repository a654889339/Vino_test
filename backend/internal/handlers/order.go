package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
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

var orderStatusMap = map[string]struct {
	Text   string `json:"text"`
	TextEn string `json:"textEn"`
	Type   string `json:"type"`
}{
	"pending":    {Text: "待支付", TextEn: "Unpaid", Type: "warning"},
	"paid":       {Text: "已支付", TextEn: "Paid", Type: "primary"},
	"processing": {Text: "进行中", TextEn: "In Progress", Type: "primary"},
	"completed":  {Text: "已完成", TextEn: "Completed", Type: "success"},
	"cancelled":  {Text: "已取消", TextEn: "Cancelled", Type: "default"},
}

func genOrderNo() string {
	now := time.Now()
	r := rand.Intn(10000)
	return fmt.Sprintf("VN%d%02d%02d%02d%02d%02d%04d",
		now.Year(), int(now.Month()), now.Day(), now.Hour(), now.Minute(), now.Second(), r)
}

func orderCreate(c *gin.Context) {
	flags := services.GetFeatureFlags()
	if !flags.EnableCreateOrder {
		resp.Err(c, 403, 403, "下单功能已关闭")
		return
	}
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	// 请求体中 price/serviceTitle/serviceTitleEn/serviceIcon 仅作前端展示用途，
	// 后端**一律以 services 表为准**，避免抓包改价（例如 149→0.01）绕过付款金额校验。
	var body struct {
		ServiceID       *int     `json:"serviceId"`
		ContactName     string   `json:"contactName"`
		ContactPhone    string   `json:"contactPhone"`
		Address         string   `json:"address"`
		AppointmentTime *string  `json:"appointmentTime"`
		Remark          string   `json:"remark"`
		ProductSerial   string   `json:"productSerial"`
		GuideID         *float64 `json:"guideId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "请求参数有误")
		return
	}
	if body.ServiceID == nil || *body.ServiceID <= 0 {
		resp.Err(c, 400, 400, "缺少服务 ID")
		return
	}
	// 以 DB 真值为权威：查出对应 service，校验上架状态，拿其 price/title/icon。
	var svc models.Service
	if err := db.DB.First(&svc, *body.ServiceID).Error; err != nil {
		resp.Err(c, 404, 404, "服务不存在")
		return
	}
	if svc.Status != "active" {
		resp.Err(c, 400, 400, "服务已下架")
		return
	}
	if svc.Price <= 0 || math.IsNaN(svc.Price) {
		resp.Err(c, 400, 400, "服务价格未正确配置")
		return
	}
	serial := strings.TrimSpace(body.ProductSerial)
	if len(serial) > 128 {
		serial = serial[:128]
	}
	var gid *int
	if body.GuideID != nil {
		g := int(*body.GuideID)
		if g > 0 {
			gid = &g
		}
	}
	var appt *time.Time
	if body.AppointmentTime != nil && *body.AppointmentTime != "" {
		t, err := time.Parse(time.RFC3339, *body.AppointmentTime)
		if err == nil {
			appt = &t
		}
	}
	svcID := svc.ID
	o := models.Order{
		OrderNo:         genOrderNo(),
		UserID:          u.ID,
		ServiceID:       &svcID,
		ServiceTitle:    svc.Title,
		ServiceTitleEn:  svc.TitleEn,
		ServiceIcon:     firstNonEmptyStr(svc.Icon, "setting-o"),
		Price:           svc.Price,
		ContactName:     body.ContactName,
		ContactPhone:    body.ContactPhone,
		Address:         body.Address,
		AppointmentTime: appt,
		Remark:          body.Remark,
		ProductSerial:   serial,
		GuideID:         gid,
		Status:          "pending",
	}
	if err := db.DB.Create(&o).Error; err != nil {
		resp.Err(c, 500, 500, "创建订单失败")
		return
	}
	resp.OK(c, o)
}

func orderMyOrders(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	status := c.Query("status")
	page := queryInt(c, "page", 1)
	pageSize := queryInt(c, "pageSize", 10)
	if pageSize > 100 {
		pageSize = 100
	}
	qb := db.DB.Model(&models.Order{}).Where("userId = ?", u.ID)
	if status != "" && status != "all" {
		qb = qb.Where("status = ?", status)
	}
	var total int64
	qb.Count(&total)
	var rows []models.Order
	qb.Order("createdAt DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&rows)

	// 历史订单在 orders.serviceTitleEn 空字段时，回读 services.titleEn 补全，
	// 避免英文端显示中文的 serviceTitle。仅补齐响应字段，不回写 DB。
	enBySvcID := map[int]string{}
	svcIDs := make([]int, 0)
	seen := map[int]bool{}
	for _, o := range rows {
		if o.ServiceTitleEn == "" && o.ServiceID != nil && *o.ServiceID > 0 && !seen[*o.ServiceID] {
			seen[*o.ServiceID] = true
			svcIDs = append(svcIDs, *o.ServiceID)
		}
	}
	if len(svcIDs) > 0 {
		var svcs []models.Service
		_ = db.DB.Select("id", "titleEn").Where("id IN ?", svcIDs).Find(&svcs).Error
		for _, s := range svcs {
			if s.TitleEn != "" {
				enBySvcID[s.ID] = s.TitleEn
			}
		}
	}

	list := make([]gin.H, 0, len(rows))
	for _, o := range rows {
		s := orderStatusMap[o.Status]
		if s.Text == "" {
			s = orderStatusMap["pending"]
		}
		raw, _ := json.Marshal(o)
		var h gin.H
		_ = json.Unmarshal(raw, &h)
		h["statusText"] = s.Text
		h["statusTextEn"] = s.TextEn
		h["statusType"] = s.Type
		if (h["serviceTitleEn"] == nil || h["serviceTitleEn"] == "") && o.ServiceID != nil {
			if en, ok := enBySvcID[*o.ServiceID]; ok {
				h["serviceTitleEn"] = en
			}
		}
		list = append(list, h)
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func orderPayWechatPrepay(c *gin.Context, cfg *config.Config) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c, "id")
	if !ok {
		resp.Err(c, 400, 400, "无效订单")
		return
	}
	if !services.IsWechatPayConfigured(cfg) {
		resp.Err(c, 503, 503, "服务器未配置微信支付")
		return
	}
	var o models.Order
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	if o.UserID != u.ID {
		resp.Err(c, 403, 403, "无权操作")
		return
	}
	if o.Status != "pending" {
		resp.Err(c, 400, 400, "仅待支付订单可发起支付")
		return
	}
	var user models.User
	if err := db.DB.First(&user, u.ID).Error; err != nil || user.Openid == nil || *user.Openid == "" {
		resp.Err(c, 400, 400, "请使用微信登录后再支付")
		return
	}
	totalFen := int(math.Round(o.Price * 100))
	if totalFen < 1 {
		resp.Err(c, 400, 400, "订单金额无效")
		return
	}
	desc := o.ServiceTitle
	if len([]rune(desc)) > 120 {
		desc = string([]rune(desc)[:120])
	}
	prepay, err := services.JsapiPrepay(cfg, o.OrderNo, desc, totalFen, *user.Openid)
	if err != nil {
		resp.Err(c, 500, 500, fmt.Sprint(err))
		return
	}
	prepayID, _ := prepay["prepay_id"].(string)
	if prepayID == "" {
		msg := "预下单失败"
		if m, ok := prepay["message"].(string); ok {
			msg = m
		}
		resp.Err(c, 500, 500, msg)
		return
	}
	params, err := services.BuildMiniProgramPayParams(cfg, prepayID)
	if err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OK(c, params)
}

func orderDetail(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c, "id")
	if !ok {
		resp.Err(c, 400, 400, "无效订单")
		return
	}
	var o models.Order
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	if o.UserID != u.ID && u.Role != "admin" {
		resp.Err(c, 403, 403, "无权查看")
		return
	}
	s := orderStatusMap[o.Status]
	raw, _ := json.Marshal(o)
	var h gin.H
	_ = json.Unmarshal(raw, &h)
	h["statusText"] = s.Text
	h["statusTextEn"] = s.TextEn
	h["statusType"] = s.Type
	if (h["serviceTitleEn"] == nil || h["serviceTitleEn"] == "") && o.ServiceID != nil && *o.ServiceID > 0 {
		var svc models.Service
		if err := db.DB.Select("titleEn").First(&svc, *o.ServiceID).Error; err == nil && svc.TitleEn != "" {
			h["serviceTitleEn"] = svc.TitleEn
		}
	}
	resp.OK(c, h)
}

func orderCancel(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c, "id")
	if !ok {
		resp.Err(c, 400, 400, "无效订单")
		return
	}
	var o models.Order
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	if o.UserID != u.ID && u.Role != "admin" {
		resp.Err(c, 403, 403, "无权操作")
		return
	}
	if o.Status == "completed" || o.Status == "cancelled" {
		resp.Err(c, 400, 400, "当前状态无法取消")
		return
	}
	o.Status = "cancelled"
	db.DB.Save(&o)
	resp.OKMsg(c, "订单已取消")
}

func orderAdminList(c *gin.Context) {
	status := c.Query("status")
	orderNo := strings.TrimSpace(c.Query("orderNo"))
	userID := strings.TrimSpace(c.Query("userId"))
	page := queryInt(c, "page", 1)
	pageSize := queryInt(c, "pageSize", 50)
	if pageSize > 200 {
		pageSize = 200
	}
	qb := db.DB.Model(&models.Order{})
	if status != "" && status != "all" {
		qb = qb.Where("status = ?", status)
	}
	if orderNo != "" {
		qb = qb.Where("orderNo LIKE ?", "%"+escapeLike(orderNo)+"%")
	}
	if userID != "" {
		if uid, err := strconv.Atoi(userID); err == nil && uid > 0 {
			qb = qb.Where("userId = ?", uid)
		}
	}
	var total int64
	sq := qb.Session(&gorm.Session{})
	sq.Count(&total)
	var rows []models.Order
	fq := qb.Session(&gorm.Session{})
	fq.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "username", "email", "nickname", "phone")
	}).Preload("Guide", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "name")
	}).Order("createdAt DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&rows)
	list := make([]gin.H, 0, len(rows))
	for _, o := range rows {
		s := orderStatusMap[o.Status]
		raw, _ := json.Marshal(o)
		var h gin.H
		_ = json.Unmarshal(raw, &h)
		h["statusText"] = s.Text
		h["statusTextEn"] = s.TextEn
		h["statusType"] = s.Type
		list = append(list, h)
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func orderAdminStats(c *gin.Context) {
	var total, pending, processing, completed, cancelled int64
	db.DB.Model(&models.Order{}).Count(&total)
	db.DB.Model(&models.Order{}).Where("status = ?", "pending").Count(&pending)
	db.DB.Model(&models.Order{}).Where("status = ?", "processing").Count(&processing)
	db.DB.Model(&models.Order{}).Where("status = ?", "completed").Count(&completed)
	db.DB.Model(&models.Order{}).Where("status = ?", "cancelled").Count(&cancelled)
	resp.OK(c, gin.H{"total": total, "pending": pending, "processing": processing, "completed": completed, "cancelled": cancelled})
}

func orderAdminUpdateStatus(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c, "id")
	if !ok {
		resp.Err(c, 400, 400, "无效订单")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "无效状态")
		return
	}
	if _, ok := orderStatusMap[body.Status]; !ok {
		resp.Err(c, 400, 400, "无效状态")
		return
	}
	var o models.Order
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	old := o.Status
	if old != body.Status {
		oldS := orderStatusMap[old].Text
		newS := orderStatusMap[body.Status].Text
		db.DB.Create(&models.OrderLog{
			OrderID:    o.ID,
			ChangeType: "status",
			OldValue:   firstNonEmptyStr(oldS, old),
			NewValue:   firstNonEmptyStr(newS, body.Status),
			Operator:   u.Username,
		})
	}
	o.Status = body.Status
	db.DB.Save(&o)
	s := orderStatusMap[o.Status]
	raw, _ := json.Marshal(o)
	var h gin.H
	_ = json.Unmarshal(raw, &h)
	h["statusText"] = s.Text
	h["statusTextEn"] = s.TextEn
	h["statusType"] = s.Type
	resp.OK(c, h)
}

func orderAdminUpdatePrice(c *gin.Context) {
	resp.Err(c, 403, 403, "订单金额已锁定，不允许修改")
}

func orderAdminAddRemark(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c, "id")
	if !ok {
		resp.Err(c, 400, 400, "无效订单")
		return
	}
	var body struct {
		Remark string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Remark) == "" {
		resp.Err(c, 400, 400, "备注不能为空")
		return
	}
	var o models.Order
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	db.DB.Create(&models.OrderLog{
		OrderID:    o.ID,
		ChangeType: "admin_remark",
		OldValue:   "",
		NewValue:   strings.TrimSpace(body.Remark),
		Operator:   u.Username,
	})
	o.AdminRemark = strings.TrimSpace(body.Remark)
	db.DB.Save(&o)
	resp.OKMsg(c, "备注已添加")
}

func orderAdminLogs(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		resp.Err(c, 400, 400, "无效订单")
		return
	}
	var logs []models.OrderLog
	db.DB.Where("orderId = ?", id).Order("createdAt DESC").Find(&logs)
	var o models.Order
	db.DB.Select("id", "orderNo", "adminRemark").First(&o, id)
	resp.OK(c, gin.H{"logs": logs, "adminRemark": o.AdminRemark})
}

// WechatPayNotify 微信支付回调（需在 main 中注册于 raw body 解析之后）
func WechatPayNotify(c *gin.Context) {
	var body map[string]interface{}
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(400, gin.H{"code": "FAIL", "message": "invalid body"})
		return
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		c.JSON(400, gin.H{"code": "FAIL", "message": "invalid body"})
		return
	}
	res, _ := body["resource"].(map[string]interface{})
	if res == nil {
		c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}
	data, err := services.DecryptNotifyResource(res)
	if err != nil {
		c.JSON(500, gin.H{"code": "FAIL", "message": "decrypt"})
		return
	}
	outTradeNo, _ := data["out_trade_no"].(string)
	tradeState, _ := data["trade_state"].(string)
	var amountFen float64
	if amt, ok := data["amount"].(map[string]interface{}); ok {
		if pt, ok := amt["payer_total"].(float64); ok {
			amountFen = pt
		} else if tt, ok := amt["total"].(float64); ok {
			amountFen = tt
		}
	}
	if tradeState != "SUCCESS" {
		c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}

	// 先查服务订单（VN 前缀）
	var svcOrder models.Order
	if err := db.DB.Where("orderNo = ?", outTradeNo).First(&svcOrder).Error; err == nil {
		if svcOrder.Status == "pending" {
			expect := int(math.Round(svcOrder.Price * 100))
			if int(amountFen) == expect {
				svcOrder.Status = "processing"
				db.DB.Save(&svcOrder)
			}
		}
		c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}

	// 再查商品订单（GO 前缀）
	var goodsOrder models.GoodsOrder
	if err := db.DB.Where("orderNo = ?", outTradeNo).First(&goodsOrder).Error; err == nil {
		if goodsOrder.Status == "pending" {
			expect := int(math.Round(goodsOrder.TotalPrice * 100))
			if int(amountFen) == expect {
				goodsOrder.Status = "paid"
				db.DB.Save(&goodsOrder)
			}
		}
		c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}

	c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
}
