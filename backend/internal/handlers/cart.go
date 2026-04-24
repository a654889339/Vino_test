package handlers

import (
	"encoding/json"
	"strings"

	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"

	"github.com/gin-gonic/gin"
)

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
	var user models.User
	_ = db.DB.Select("id", "cartJson").First(&user, u.ID).Error
	lines, totalPrice, totalCount := resolveCartLines(user.CartJSON)
	resp.OK(c, gin.H{
		"items":      lines,
		"totalPrice": totalPrice,
		"totalCount": totalCount,
	})
}

