package models

import "time"

// CartItem 用户购物车行（与 users.cartJson 双写；无贴花列）。
type CartItem struct {
	ID                 int       `gorm:"primaryKey" json:"id"`
	Versioned
	UserID             int       `gorm:"column:userId;not null;index:idx_cart_items_userId;uniqueIndex:uq_cart_items_user_guide,priority:1" json:"userId"`
	GuideID            int       `gorm:"column:guideId;not null;index:idx_cart_items_guideId;uniqueIndex:uq_cart_items_user_guide,priority:2" json:"guideId"`
	Qty                int       `gorm:"not null;default:1" json:"qty"`
	NameSnapshot       string    `gorm:"column:nameSnapshot;size:200" json:"nameSnapshot"`
	UnitPriceSnapshot  float64   `gorm:"column:unitPriceSnapshot;type:decimal(10,2)" json:"unitPriceSnapshot"`
	CurrencySnapshot   string    `gorm:"column:currencySnapshot;size:10" json:"currencySnapshot"`
	CreatedAt          time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt          time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	User  *User         `gorm:"foreignKey:UserID;constraint:-" json:"user,omitempty"`
	Guide *DeviceGuide `gorm:"foreignKey:GuideID;constraint:-" json:"guide,omitempty"`
}

func (CartItem) TableName() string { return "cart_items" }
