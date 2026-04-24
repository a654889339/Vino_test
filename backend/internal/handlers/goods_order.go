package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"
	"vino/backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func genGoodsOrderNo() string {
	now := time.Now()
	var b [4]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("GO%d%02d%02d%02d%02d%02d%s",
		now.Year(), int(now.Month()), now.Day(), now.Hour(), now.Minute(), now.Second(), hex.EncodeToString(b[:]))
}

// goodsOrderCheckout POST /api/goods-orders/checkout
// body: { contactName, contactPhone, address, remark }
func goodsOrderCheckout(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
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
		if currency == "" {
			currency = cur
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

