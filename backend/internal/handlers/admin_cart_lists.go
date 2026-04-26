package handlers

import (
	"strconv"
	"strings"
	"time"

	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// adminListUserCarts GET /api/admin/user-carts — 有购物车内容的用户（非空 cartJson 或存在 cart_items）。
func adminListUserCarts(c *gin.Context) {
	page := queryInt(c, "page", 1)
	pageSize := queryInt(c, "pageSize", 50)
	if pageSize > 200 {
		pageSize = 200
	}
	q := strings.TrimSpace(c.Query("q"))
	searchType := c.Query("searchType")

	qb := db.DB.Model(&models.User{}).Where(
		"(cartJson IS NOT NULL AND TRIM(cartJson) != '' AND cartJson != ?) OR EXISTS (SELECT 1 FROM cart_items c WHERE c.userId = users.id)",
		"[]",
	)
	if q != "" && searchType != "" {
		switch searchType {
		case "id":
			id, _ := strconv.Atoi(q)
			if id > 0 {
				qb = qb.Where("users.id = ?", id)
			} else {
				qb = qb.Where("users.id = ?", -1)
			}
		case "username":
			qb = qb.Where("users.username LIKE ?", "%"+escapeLike(q)+"%")
		case "phone":
			qb = qb.Where("users.phone LIKE ?", "%"+escapeLike(q)+"%")
		}
	}

	var total int64
	if err := qb.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		resp.Err(c, 500, 500, "统计失败")
		return
	}
	offset := (page - 1) * pageSize
	var users []models.User
	if err := qb.Session(&gorm.Session{}).
		Select("id", "username", "phone", "cartJson", "createdAt").
		Order("users.id DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&users).Error; err != nil {
		resp.Err(c, 500, 500, "查询失败")
		return
	}
	ids := make([]int, 0, len(users))
	for _, u := range users {
		ids = append(ids, u.ID)
	}
	cntByUser := map[int]int64{}
	if len(ids) > 0 {
		type cntRow struct {
			UserID int   `gorm:"column:userId"`
			Cnt    int64 `gorm:"column:cnt"`
		}
		var crows []cntRow
		_ = db.DB.Model(&models.CartItem{}).
			Select("userId, COUNT(*) as cnt").
			Where("userId IN ?", ids).
			Group("userId").
			Scan(&crows).Error
		for _, r := range crows {
			cntByUser[r.UserID] = r.Cnt
		}
	}
	list := make([]gin.H, 0, len(users))
	for _, u := range users {
		snip := ""
		if u.CartJSON != nil {
			s := strings.TrimSpace(*u.CartJSON)
			if len(s) > 160 {
				snip = s[:160] + "…"
			} else {
				snip = s
			}
		}
		list = append(list, gin.H{
			"id":             u.ID,
			"username":       u.Username,
			"phone":          u.Phone,
			"cartJsonSnippet": snip,
			"cartItemCount":  cntByUser[u.ID],
			"createdAt":      u.CreatedAt,
		})
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

// adminListCartItems GET /api/admin/cart-items
func adminListCartItems(c *gin.Context) {
	page := queryInt(c, "page", 1)
	pageSize := queryInt(c, "pageSize", 50)
	if pageSize > 200 {
		pageSize = 200
	}
	userID := strings.TrimSpace(c.Query("userId"))
	guideID := strings.TrimSpace(c.Query("guideId"))
	kw := strings.TrimSpace(c.Query("q"))

	qb := db.DB.Table("cart_items AS ci").
		Joins("LEFT JOIN users AS u ON u.id = ci.userId").
		Joins("LEFT JOIN device_guides AS g ON g.id = ci.guideId")
	if userID != "" {
		if uid, err := strconv.Atoi(userID); err == nil && uid > 0 {
			qb = qb.Where("ci.userId = ?", uid)
		}
	}
	if guideID != "" {
		if gid, err := strconv.Atoi(guideID); err == nil && gid > 0 {
			qb = qb.Where("ci.guideId = ?", gid)
		}
	}
	if kw != "" {
		like := "%" + escapeLike(kw) + "%"
		qb = qb.Where("(u.username LIKE ? OR g.name LIKE ? OR ci.nameSnapshot LIKE ?)", like, like, like)
	}

	var total int64
	if err := qb.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		resp.Err(c, 500, 500, "统计失败")
		return
	}
	type row struct {
		ID                int       `gorm:"column:id" json:"id"`
		UserID            int       `gorm:"column:userId" json:"userId"`
		GuideID           int       `gorm:"column:guideId" json:"guideId"`
		Qty               int       `gorm:"column:qty" json:"qty"`
		NameSnapshot      string    `gorm:"column:nameSnapshot" json:"nameSnapshot"`
		UnitPriceSnapshot float64   `gorm:"column:unitPriceSnapshot" json:"unitPriceSnapshot"`
		CurrencySnapshot  string    `gorm:"column:currencySnapshot" json:"currencySnapshot"`
		CreatedAt         time.Time `gorm:"column:createdAt" json:"createdAt"`
		UpdatedAt         time.Time `gorm:"column:updatedAt" json:"updatedAt"`
		Username          string    `gorm:"column:username" json:"username"`
		GuideName         string    `gorm:"column:guideName" json:"guideName"`
	}
	var rows []row
	err := qb.Session(&gorm.Session{}).
		Select(`ci.id, ci.userId, ci.guideId, ci.qty, ci.nameSnapshot, ci.unitPriceSnapshot, ci.currencySnapshot,
			ci.createdAt, ci.updatedAt, u.username, g.name AS guideName`).
		Order("ci.id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Scan(&rows).Error
	if err != nil {
		resp.Err(c, 500, 500, "查询失败")
		return
	}
	list := make([]gin.H, 0, len(rows))
	for _, r := range rows {
		list = append(list, gin.H{
			"id":                 r.ID,
			"userId":             r.UserID,
			"username":           r.Username,
			"guideId":            r.GuideID,
			"guideName":          r.GuideName,
			"qty":                r.Qty,
			"nameSnapshot":       r.NameSnapshot,
			"unitPriceSnapshot":  r.UnitPriceSnapshot,
			"currencySnapshot":   r.CurrencySnapshot,
			"createdAt":          r.CreatedAt,
			"updatedAt":          r.UpdatedAt,
		})
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

// adminListGoodsOrderItems GET /api/admin/goods-order-items — 行表明细 + 订单号/用户/商品名检索。
func adminListGoodsOrderItems(c *gin.Context) {
	orderID := strings.TrimSpace(c.Query("orderId"))
	orderNo := strings.TrimSpace(c.Query("orderNo"))
	userID := strings.TrimSpace(c.Query("userId"))
	guideID := strings.TrimSpace(c.Query("guideId"))
	page := queryInt(c, "page", 1)
	pageSize := queryInt(c, "pageSize", 50)
	if pageSize > 200 {
		pageSize = 200
	}

	qb := db.DB.Table("goods_order_items AS i").
		Joins("LEFT JOIN goods_orders AS o ON o.id = i.orderId").
		Joins("LEFT JOIN device_guides AS g ON g.id = i.guideId")
	if orderID != "" {
		if oid, err := strconv.Atoi(orderID); err == nil && oid > 0 {
			qb = qb.Where("i.orderId = ?", oid)
		}
	}
	if orderNo != "" {
		qb = qb.Where("o.orderNo LIKE ?", "%"+escapeLike(orderNo)+"%")
	}
	if userID != "" {
		if uid, err := strconv.Atoi(userID); err == nil && uid > 0 {
			qb = qb.Where("o.userId = ?", uid)
		}
	}
	if guideID != "" {
		if gid, err := strconv.Atoi(guideID); err == nil && gid > 0 {
			qb = qb.Where("i.guideId = ?", gid)
		}
	}

	var total int64
	if err := qb.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		resp.Err(c, 500, 500, "统计失败")
		return
	}
	type row struct {
		ID           int      `gorm:"column:id" json:"id"`
		OrderID      int      `gorm:"column:orderId" json:"orderId"`
		OrderNo      string   `gorm:"column:orderNo" json:"orderNo"`
		UserID       int      `gorm:"column:userId" json:"userId"`
		GuideID      int      `gorm:"column:guideId" json:"guideId"`
		GuideName    string   `gorm:"column:guideName" json:"guideName"`
		NameSnapshot string   `gorm:"column:nameSnapshot" json:"nameSnapshot"`
		ImageURL     string   `gorm:"column:imageUrl" json:"imageUrl"`
		UnitPrice    float64  `gorm:"column:unitPrice" json:"unitPrice"`
		OriginPrice  *float64 `gorm:"column:originPrice" json:"originPrice,omitempty"`
		Currency     string   `gorm:"column:currency" json:"currency"`
		Qty          int      `gorm:"column:qty" json:"qty"`
		LineTotal    float64  `gorm:"column:lineTotal" json:"lineTotal"`
	}
	var rows []row
	err := qb.Session(&gorm.Session{}).
		Select(`i.id, i.orderId, o.orderNo, o.userId, i.guideId, g.name AS guideName,
			i.nameSnapshot, i.imageUrl, i.unitPrice, i.originPrice, i.currency, i.qty, i.lineTotal`).
		Order("i.id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Scan(&rows).Error
	if err != nil {
		resp.Err(c, 500, 500, "查询失败")
		return
	}
	list := make([]gin.H, 0, len(rows))
	for _, r := range rows {
		list = append(list, gin.H{
			"id": r.ID, "orderId": r.OrderID, "orderNo": r.OrderNo, "userId": r.UserID,
			"guideId": r.GuideID, "guideName": r.GuideName, "nameSnapshot": r.NameSnapshot,
			"imageUrl": r.ImageURL, "unitPrice": r.UnitPrice, "originPrice": r.OriginPrice,
			"currency": r.Currency, "qty": r.Qty, "lineTotal": r.LineTotal,
		})
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}
