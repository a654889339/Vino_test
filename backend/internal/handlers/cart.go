package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"strings"

	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ErrCartMixedCurrency 购物车中存在多种非空币种（与 PUT /api/cart 校验一致）。
var ErrCartMixedCurrency = errors.New("购物车不支持混币种商品")

// validateCartLinesCurrency 校验多行购物车商品币种一致（空币种不参与约束）。tx 可为 nil 表示使用默认 db.DB。
func validateCartLinesCurrency(tx *gorm.DB, items []cartLineIn) error {
	if len(items) == 0 {
		return nil
	}
	if tx == nil {
		tx = db.DB
	}
	ids := make([]int, 0, len(items))
	for _, it := range items {
		if it.GuideID > 0 {
			ids = append(ids, it.GuideID)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	var rows []struct {
		ID       int    `gorm:"column:id"`
		Currency string `gorm:"column:currency"`
	}
	_ = tx.Model(&models.DeviceGuide{}).Select("id", "currency").Where("id IN ?", ids).Find(&rows).Error
	cMap := map[int]string{}
	for _, r := range rows {
		cMap[r.ID] = strings.TrimSpace(r.Currency)
	}
	seen := ""
	for _, it := range items {
		cur := strings.TrimSpace(cMap[it.GuideID])
		if cur == "" {
			continue
		}
		if seen == "" {
			seen = cur
			continue
		}
		if !strings.EqualFold(seen, cur) {
			return ErrCartMixedCurrency
		}
	}
	return nil
}

type cartLineIn struct {
	GuideID int `json:"guideId"`
	Qty     int `json:"qty"`
}

type cartLineOut struct {
	GuideID     int      `json:"guideId"`
	Qty         int      `json:"qty"`
	Name        string   `json:"name"`
	Subtitle    string   `json:"subtitle"`
	Description string   `json:"description"`
	ImageURL    string   `json:"imageUrl"`
	ListPrice   float64  `json:"listPrice"`
	OriginPrice *float64 `json:"originPrice"`
	Currency    string   `json:"currency"`
	LineTotal   float64  `json:"lineTotal"`
}

func parseUserCartJSON(raw *string) []cartLineIn {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil
	}
	var items []cartLineIn
	if err := json.Unmarshal([]byte(*raw), &items); err != nil {
		return nil
	}
	out := make([]cartLineIn, 0, len(items))
	for _, it := range items {
		if it.GuideID <= 0 || it.Qty <= 0 {
			continue
		}
		if it.Qty > 9999 {
			it.Qty = 9999
		}
		out = append(out, it)
	}
	return out
}

// ReplaceCartItemsFromCartJSON 事务内将 userId 对应的 cart_items 全量替换为 cartJson 解析结果（与 mergeCartLines 规则一致）。
func ReplaceCartItemsFromCartJSON(tx *gorm.DB, userID int, cartJSON *string) error {
	if err := tx.Where("userId = ?", userID).Delete(&models.CartItem{}).Error; err != nil {
		return err
	}
	merged := mergeCartLines(parseUserCartJSON(cartJSON))
	for _, it := range merged {
		var g models.DeviceGuide
		name := ""
		unit := 0.0
		cur := ""
		if err := tx.Select("id", "name", "listPrice", "currency").First(&g, it.GuideID).Error; err == nil {
			name = strings.TrimSpace(g.Name)
			unit = g.ListPrice
			if unit < 0 {
				unit = 0
			}
			cur = strings.TrimSpace(g.Currency)
		}
		row := models.CartItem{
			UserID:            userID,
			GuideID:           it.GuideID,
			Qty:               it.Qty,
			NameSnapshot:      name,
			UnitPriceSnapshot: unit,
			CurrencySnapshot:  cur,
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

// BackfillCartItemsForAllUsers 扫描 cartJson 非空的用户并写入 cart_items（用于空表一次性回填）。
func BackfillCartItemsForAllUsers() {
	var users []models.User
	if err := db.DB.Select("id", "cartJson").Where("(cartJson IS NOT NULL AND TRIM(cartJson) != '' AND cartJson != ?)", "[]").Find(&users).Error; err != nil {
		log.Printf("[Vino] BackfillCartItemsForAllUsers: list users: %v", err)
		return
	}
	for _, u := range users {
		uid := u.ID
		cj := u.CartJSON
		if err := db.DB.Transaction(func(tx *gorm.DB) error {
			return ReplaceCartItemsFromCartJSON(tx, uid, cj)
		}); err != nil {
			log.Printf("[Vino] BackfillCartItemsForAllUsers userId=%d: %v", uid, err)
		}
	}
}

func mergeCartLines(items []cartLineIn) []cartLineIn {
	byID := map[int]int{}
	for _, it := range items {
		if it.GuideID <= 0 || it.Qty <= 0 {
			continue
		}
		byID[it.GuideID] += it.Qty
	}
	out := make([]cartLineIn, 0, len(byID))
	for gid, q := range byID {
		if q > 9999 {
			q = 9999
		}
		out = append(out, cartLineIn{GuideID: gid, Qty: q})
	}
	return out
}

func resolveCartLines(cartRaw *string) (lines []cartLineOut, totalPrice float64, totalCount int) {
	items := parseUserCartJSON(cartRaw)
	if len(items) == 0 {
		return nil, 0, 0
	}
	lines = make([]cartLineOut, 0, len(items))
	for _, it := range items {
		var g models.DeviceGuide
		if err := db.DB.First(&g, it.GuideID).Error; err != nil || g.Status != "active" {
			continue
		}
		unit := g.ListPrice
		if unit < 0 {
			unit = 0
		}
		lineTot := unit * float64(it.Qty)
		img := strings.TrimSpace(g.CoverImage)
		if img == "" {
			img = strings.TrimSpace(g.IconURL)
		}
		lines = append(lines, cartLineOut{
			GuideID:     g.ID,
			Qty:         it.Qty,
			Name:        g.Name,
			Subtitle:    g.Subtitle,
			Description: g.Description,
			ImageURL:    img,
			ListPrice:   unit,
			OriginPrice: g.OriginPrice,
			Currency:    strings.TrimSpace(g.Currency),
			LineTotal:   lineTot,
		})
		totalPrice += lineTot
		totalCount += it.Qty
	}
	return lines, totalPrice, totalCount
}

// meGetCart GET /api/cart
func meGetCart(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var user models.User
	if err := db.DB.Select("id", "cartJson").First(&user, u.ID).Error; err != nil {
		resp.Err(c, 404, 404, "用户不存在")
		return
	}
	lines, totalPrice, totalCount := resolveCartLines(user.CartJSON)
	resp.OK(c, gin.H{
		"items":      lines,
		"totalPrice": totalPrice,
		"totalCount": totalCount,
	})
}

// mePutCart PUT /api/cart  body: { items: [{ guideId, qty }] }
func mePutCart(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body struct {
		Items []cartLineIn `json:"items"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	merged := mergeCartLines(body.Items)
	if err := validateCartLinesCurrency(nil, merged); err != nil {
		resp.Err(c, 400, 400, err.Error())
		return
	}

	b, err := json.Marshal(merged)
	if err != nil {
		resp.Err(c, 500, 500, "保存失败")
		return
	}
	s := string(b)
	if err := db.DB.Exec("UPDATE `users` SET `cartJson` = ? WHERE `id` = ?", s, u.ID).Error; err != nil {
		resp.Err(c, 500, 500, "保存失败")
		return
	}
	if err := db.DB.Transaction(func(tx *gorm.DB) error {
		return ReplaceCartItemsFromCartJSON(tx, u.ID, &s)
	}); err != nil {
		resp.Err(c, 500, 500, "保存失败")
		return
	}
	var user models.User
	_ = db.DB.Select("id", "cartJson").First(&user, u.ID).Error
	lines, totalPrice, totalCount := resolveCartLines(user.CartJSON)
	resp.OK(c, gin.H{
		"items":      lines,
		"totalPrice": totalPrice,
		"totalCount": totalCount,
	})
}

