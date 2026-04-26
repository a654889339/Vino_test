package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
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

// errGoodsOrderCancelRace 事务内将订单置为取消时受影响行数为 0（并发支付或已取消）。
var errGoodsOrderCancelRace = errors.New("goods_order_cancel_race")

func genGoodsOrderNo() string {
	now := time.Now()
	var b [4]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("GO%d%02d%02d%02d%02d%02d%s",
		now.Year(), int(now.Month()), now.Day(), now.Hour(), now.Minute(), now.Second(), hex.EncodeToString(b[:]))
}

// goodsOrderCheckout POST /api/goods-orders/checkout
// 以用户 DB 中整份 cartJson 为准生成订单并清空车；与前端「勾选展示」关系见 .cursor/skills/vino-cart-goods-order/SKILL.md。
// body: { contactName, contactPhone, address, remark }
func goodsOrderCheckout(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	flags := services.GetFeatureFlags()
	if !flags.EnableGoodsOrder {
		resp.Err(c, 403, 403, "商品下单功能已关闭")
		return
	}
	var body struct {
		ContactName  string `json:"contactName"`
		ContactPhone string `json:"contactPhone"`
		Address      string `json:"address"`
		Remark       string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if strings.TrimSpace(body.ContactName) == "" || strings.TrimSpace(body.ContactPhone) == "" {
		resp.Err(c, 400, 400, "请填写联系人和电话")
		return
	}
	phoneKey := services.NormalizePhone(body.ContactPhone)
	if len(phoneKey) != 11 || phoneKey[0] != '1' {
		resp.Err(c, 400, 400, "请输入正确的11位大陆手机号")
		return
	}

	var user models.User
	if err := db.DB.Select("id", "cartJson").First(&user, u.ID).Error; err != nil {
		resp.Err(c, 404, 404, "用户不存在")
		return
	}
	items := parseUserCartJSON(user.CartJSON)
	if len(items) == 0 {
		resp.Err(c, 400, 400, "购物车为空")
		return
	}

	type row struct {
		GuideID    int
		Qty        int
		Name       string
		ImageURL   string
		UnitPrice  float64
		OriginPrice *float64
		Currency   string
		LineTotal  float64
	}
	rows := make([]row, 0, len(items))
	var total float64
	currency := ""
	for _, it := range items {
		var g models.DeviceGuide
		if err := db.DB.First(&g, it.GuideID).Error; err != nil || g.Status != "active" {
			continue
		}
		unit := g.ListPrice
		if unit < 0 {
			unit = 0
		}
		if unit == 0 {
			resp.Err(c, 400, 400, "存在未配置价格的商品，无法下单")
			return
		}
		img := strings.TrimSpace(g.CoverImage)
		if img == "" {
			img = strings.TrimSpace(g.IconURL)
		}
		cur := strings.TrimSpace(g.Currency)
		// 兜底禁止混币种：以首个非空币种为准，其它商品必须一致
		if currency == "" && cur != "" {
			currency = cur
		}
		if currency != "" && cur != "" && !strings.EqualFold(currency, cur) {
			resp.Err(c, 400, 400, "购物车不支持混币种商品")
			return
		}
		lineTot := unit * float64(it.Qty)
		rows = append(rows, row{
			GuideID:    g.ID,
			Qty:        it.Qty,
			Name:       g.Name,
			ImageURL:   img,
			UnitPrice:  unit,
			OriginPrice: g.OriginPrice,
			Currency:   cur,
			LineTotal:  lineTot,
		})
		total += lineTot
	}
	if len(rows) == 0 {
		resp.Err(c, 400, 400, "购物车中没有可结算的商品")
		return
	}

	var out models.GoodsOrder
	err := db.DB.Transaction(func(tx *gorm.DB) error {
		o := models.GoodsOrder{
			OrderNo:      genGoodsOrderNo(),
			UserID:       u.ID,
			Status:       "pending",
			TotalPrice:   total,
			Currency:     currency,
			ContactName:  strings.TrimSpace(body.ContactName),
			ContactPhone: phoneKey,
			Address:      strings.TrimSpace(body.Address),
			Remark:       strings.TrimSpace(body.Remark),
		}
		if err := tx.Create(&o).Error; err != nil {
			return err
		}
		orderItems := make([]models.GoodsOrderItem, 0, len(rows))
		for _, r := range rows {
			orderItems = append(orderItems, models.GoodsOrderItem{
				OrderID:      o.ID,
				GuideID:      r.GuideID,
				NameSnapshot: r.Name,
				ImageURL:     r.ImageURL,
				UnitPrice:    r.UnitPrice,
				OriginPrice:  r.OriginPrice,
				Currency:     r.Currency,
				Qty:          r.Qty,
				LineTotal:    r.LineTotal,
			})
		}
		if err := tx.Create(&orderItems).Error; err != nil {
			return err
		}
		empty := "[]"
		if err := tx.Exec("UPDATE `users` SET `cartJson` = ? WHERE `id` = ?", empty, u.ID).Error; err != nil {
			return err
		}
		if err := ReplaceCartItemsFromCartJSON(tx, u.ID, &empty); err != nil {
			return err
		}
		out = o
		out.Items = orderItems
		return nil
	})
	if err != nil {
		resp.Err(c, 500, 500, "创建订单失败")
		return
	}
	resp.OK(c, out)
}

// goodsOrderList GET /api/goods-orders?status=&page=&pageSize=
func goodsOrderList(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	status := strings.TrimSpace(c.Query("status"))
	page := queryInt(c, "page", 1)
	pageSize := queryInt(c, "pageSize", 20)
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	qb := db.DB.Model(&models.GoodsOrder{}).Where("userId = ?", u.ID)
	if status != "" && status != "all" {
		qb = qb.Where("status = ?", status)
	}
	var total int64
	qb.Count(&total)
	var rows []models.GoodsOrder
	qb.Preload("Items").Order("createdAt DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&rows)
	resp.OK(c, gin.H{"list": rows, "total": total, "page": page, "pageSize": pageSize})
}

// goodsOrderDetail GET /api/goods-orders/:id
func goodsOrderDetail(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c, "id")
	if !ok {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	var o models.GoodsOrder
	if err := db.DB.Preload("Items").First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	if o.UserID != u.ID {
		resp.Err(c, 403, 403, "无权查看该订单")
		return
	}
	resp.OK(c, o)
}

// goodsOrderUserCancel POST /api/goods-orders/:id/cancel — 待付款取消并将订单行合并回 cartJson。
func goodsOrderUserCancel(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c, "id")
	if !ok {
		resp.Err(c, 400, 400, "参数错误")
		return
	}

	var o models.GoodsOrder
	if err := db.DB.Preload("Items").First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	if o.UserID != u.ID {
		resp.Err(c, 403, 403, "无权操作该订单")
		return
	}
	if o.Status != "pending" {
		resp.Err(c, 400, 400, "仅待付款订单可取消")
		return
	}

	err := db.DB.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.GoodsOrder{}).Where("id = ? AND userId = ? AND status = ?", id, u.ID, "pending").Update("status", "cancelled")
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return errGoodsOrderCancelRace
		}

		var user models.User
		if err := tx.Select("id", "cartJson").First(&user, u.ID).Error; err != nil {
			return err
		}
		cur := parseUserCartJSON(user.CartJSON)
		for _, line := range o.Items {
			cur = append(cur, cartLineIn{GuideID: line.GuideID, Qty: line.Qty})
		}
		merged := mergeCartLines(cur)
		if err := validateCartLinesCurrency(tx, merged); err != nil {
			return err
		}
		b, err := json.Marshal(merged)
		if err != nil {
			return err
		}
		mergedStr := string(b)
		if err := tx.Exec("UPDATE `users` SET `cartJson` = ? WHERE `id` = ?", mergedStr, u.ID).Error; err != nil {
			return err
		}
		return ReplaceCartItemsFromCartJSON(tx, u.ID, &mergedStr)
	})
	if err != nil {
		if errors.Is(err, errGoodsOrderCancelRace) {
			resp.Err(c, 409, 409, "订单状态已变更，请刷新后重试")
			return
		}
		if errors.Is(err, ErrCartMixedCurrency) {
			resp.Err(c, 400, 400, "恢复购物车后将出现混币种，请先调整购物车后再取消订单")
			return
		}
		resp.Err(c, 500, 500, "取消失败")
		return
	}
	resp.OKMsg(c, "已取消订单，商品已回到购物车")
}

// goodsOrderPayWechatPrepay POST /api/goods-orders/:id/pay-wechat
func goodsOrderPayWechatPrepay(c *gin.Context, cfg *config.Config) {
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
	var o models.GoodsOrder
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
	totalFen := int(math.Round(o.TotalPrice * 100))
	if totalFen < 1 {
		resp.Err(c, 400, 400, "订单金额无效")
		return
	}
	desc := "商品订单"
	if len(o.Items) > 0 {
		desc = o.Items[0].NameSnapshot
		if len([]rune(desc)) > 120 {
			desc = string([]rune(desc)[:120])
		}
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

// ---- 管理端 商品订单 ----

// goodsOrderAdminList GET /api/goods-orders/admin/list
// query: status orderNo userId page pageSize
func goodsOrderAdminList(c *gin.Context) {
	status := c.Query("status")
	orderNo := strings.TrimSpace(c.Query("orderNo"))
	userID := strings.TrimSpace(c.Query("userId"))
	page := queryInt(c, "page", 1)
	pageSize := queryInt(c, "pageSize", 50)
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 200 {
		pageSize = 200
	}
	qb := db.DB.Model(&models.GoodsOrder{})
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
	var rows []models.GoodsOrder
	fq := qb.Session(&gorm.Session{})
	fq.Preload("Items").Order("createdAt DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&rows)

	userIDs := make([]int, 0, len(rows))
	seen := map[int]bool{}
	for _, o := range rows {
		if !seen[o.UserID] {
			seen[o.UserID] = true
			userIDs = append(userIDs, o.UserID)
		}
	}
	userByID := map[int]models.User{}
	if len(userIDs) > 0 {
		var users []models.User
		_ = db.DB.Select("id", "username", "email", "nickname", "phone").Where("id IN ?", userIDs).Find(&users).Error
		for _, u := range users {
			userByID[u.ID] = u
		}
	}

	list := make([]gin.H, 0, len(rows))
	for _, o := range rows {
		s := orderStatusMap[o.Status]
		raw, _ := json.Marshal(o)
		var h gin.H
		_ = json.Unmarshal(raw, &h)
		h["statusText"] = s.Text
		h["statusTextEn"] = s.TextEn
		h["statusType"] = s.Type
		if u, ok := userByID[o.UserID]; ok {
			h["username"] = u.Username
			h["userPhone"] = u.Phone
			h["userNickname"] = u.Nickname
		}
		// 汇总件数
		qty := 0
		for _, it := range o.Items {
			qty += it.Qty
		}
		h["totalQty"] = qty
		list = append(list, h)
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

// goodsOrderAdminItems GET /api/goods-orders/admin/items
// query: orderId orderNo page pageSize
func goodsOrderAdminItems(c *gin.Context) {
	orderID := strings.TrimSpace(c.Query("orderId"))
	orderNo := strings.TrimSpace(c.Query("orderNo"))
	page := queryInt(c, "page", 1)
	pageSize := queryInt(c, "pageSize", 50)
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 200 {
		pageSize = 200
	}

	qb := db.DB.Table("goods_order_items AS i").
		Joins("LEFT JOIN goods_orders AS o ON o.id = i.orderId")
	if orderID != "" {
		if oid, err := strconv.Atoi(orderID); err == nil && oid > 0 {
			qb = qb.Where("i.orderId = ?", oid)
		}
	}
	if orderNo != "" {
		qb = qb.Where("o.orderNo LIKE ?", "%"+escapeLike(orderNo)+"%")
	}

	var total int64
	qb.Session(&gorm.Session{}).Count(&total)

	// 必须写 gorm column：MySQL 驱动返回的列名为 camelCase（如 orderId），否则 Scan 无法填入结构体字段。
	type itemRow struct {
		ID           int      `gorm:"column:id" json:"id"`
		OrderID      int      `gorm:"column:orderId" json:"orderId"`
		GuideID      int      `gorm:"column:guideId" json:"guideId"`
		NameSnapshot string   `gorm:"column:nameSnapshot" json:"nameSnapshot"`
		ImageURL     string   `gorm:"column:imageUrl" json:"imageUrl"`
		UnitPrice    float64  `gorm:"column:unitPrice" json:"unitPrice"`
		OriginPrice  *float64 `gorm:"column:originPrice" json:"originPrice,omitempty"`
		Currency     string   `gorm:"column:currency" json:"currency"`
		Qty          int      `gorm:"column:qty" json:"qty"`
		LineTotal    float64  `gorm:"column:lineTotal" json:"lineTotal"`
	}
	var rows []itemRow
	err := qb.Session(&gorm.Session{}).
		Select("i.id, i.orderId, i.guideId, i.nameSnapshot, i.imageUrl, i.unitPrice, i.originPrice, i.currency, i.qty, i.lineTotal").
		Order("i.id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Scan(&rows).Error
	if err != nil {
		resp.Err(c, 500, 500, "读取商品订单明细失败")
		return
	}
	resp.OK(c, gin.H{"list": rows, "total": total, "page": page, "pageSize": pageSize})
}

// goodsOrderAdminStats GET /api/goods-orders/admin/stats
func goodsOrderAdminStats(c *gin.Context) {
	var total, pending, paid, processing, completed, cancelled int64
	db.DB.Model(&models.GoodsOrder{}).Count(&total)
	db.DB.Model(&models.GoodsOrder{}).Where("status = ?", "pending").Count(&pending)
	db.DB.Model(&models.GoodsOrder{}).Where("status = ?", "paid").Count(&paid)
	db.DB.Model(&models.GoodsOrder{}).Where("status = ?", "processing").Count(&processing)
	db.DB.Model(&models.GoodsOrder{}).Where("status = ?", "completed").Count(&completed)
	db.DB.Model(&models.GoodsOrder{}).Where("status = ?", "cancelled").Count(&cancelled)
	resp.OK(c, gin.H{
		"total": total, "pending": pending, "paid": paid,
		"processing": processing, "completed": completed, "cancelled": cancelled,
	})
}

// goodsOrderAdminUpdateStatus PUT /api/goods-orders/admin/:id/status
func goodsOrderAdminUpdateStatus(c *gin.Context) {
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
	var o models.GoodsOrder
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	old := o.Status
	if old != body.Status {
		oldS := orderStatusMap[old].Text
		newS := orderStatusMap[body.Status].Text
		db.DB.Create(&models.GoodsOrderLog{
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

// goodsOrderAdminUpdatePrice PUT /api/goods-orders/admin/:id/price
// body: { price }  —— 变更的是订单合计 totalPrice；items 明细保留原快照。
func goodsOrderAdminUpdatePrice(c *gin.Context) {
	resp.Err(c, 403, 403, "订单金额已锁定，不允许修改")
}

// goodsOrderAdminAddRemark POST /api/goods-orders/admin/:id/remark
func goodsOrderAdminAddRemark(c *gin.Context) {
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
	var o models.GoodsOrder
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	db.DB.Create(&models.GoodsOrderLog{
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

// goodsOrderAdminLogs GET /api/goods-orders/admin/:id/logs
func goodsOrderAdminLogs(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		resp.Err(c, 400, 400, "无效订单")
		return
	}
	var logs []models.GoodsOrderLog
	db.DB.Where("orderId = ?", id).Order("createdAt DESC").Find(&logs)
	var o models.GoodsOrder
	db.DB.Select("id", "orderNo", "adminRemark").First(&o, id)
	resp.OK(c, gin.H{"logs": logs, "adminRemark": o.AdminRemark})
}
