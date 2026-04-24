package models

import "time"

// GoodsOrder 商品订单（购物车下单）
type GoodsOrder struct {
	ID           int       `gorm:"primaryKey" json:"id"`
	OrderNo      string    `gorm:"column:orderNo;size:32;not null;uniqueIndex:uq_goods_orders_orderNo" json:"orderNo"`
	UserID       int       `gorm:"column:userId;not null;index:idx_goods_orders_userId_createdAt,priority:1" json:"userId"`
	Status       string    `gorm:"type:enum('pending','paid','processing','completed','cancelled');default:pending;index:idx_goods_orders_status_createdAt,priority:1" json:"status"`
	TotalPrice   float64   `gorm:"column:totalPrice;type:decimal(10,2)" json:"totalPrice"`
	Currency     string    `gorm:"column:currency;size:10" json:"currency"`
	ContactName  string    `gorm:"column:contactName;size:50" json:"contactName"`
	ContactPhone string    `gorm:"column:contactPhone;size:20" json:"contactPhone"`
	Address      string    `gorm:"size:500" json:"address"`
	Remark       string    `gorm:"type:text" json:"remark"`
	CreatedAt    time.Time `gorm:"column:createdAt;index:idx_goods_orders_userId_createdAt,priority:2;index:idx_goods_orders_status_createdAt,priority:2" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Items []GoodsOrderItem `gorm:"foreignKey:OrderID;constraint:-" json:"items,omitempty"`
}

func (GoodsOrder) TableName() string { return "goods_orders" }

type GoodsOrderItem struct {
	ID           int     `gorm:"primaryKey" json:"id"`
	OrderID      int     `gorm:"column:orderId;not null;index:idx_goods_order_items_orderId" json:"orderId"`
	GuideID      int     `gorm:"column:guideId;not null;index:idx_goods_order_items_guideId" json:"guideId"`
	NameSnapshot string  `gorm:"column:nameSnapshot;size:200" json:"nameSnapshot"`
	ImageURL     string  `gorm:"column:imageUrl;size:500" json:"imageUrl"`
	UnitPrice    float64 `gorm:"column:unitPrice;type:decimal(10,2)" json:"unitPrice"`
	OriginPrice  *float64 `gorm:"column:originPrice;type:decimal(10,2)" json:"originPrice"`
	Currency     string  `gorm:"column:currency;size:10" json:"currency"`
	Qty          int     `gorm:"not null;default:1" json:"qty"`
	LineTotal    float64 `gorm:"column:lineTotal;type:decimal(10,2)" json:"lineTotal"`

	Guide *DeviceGuide `gorm:"foreignKey:GuideID;constraint:-" json:"guide,omitempty"`
}

func (GoodsOrderItem) TableName() string { return "goods_order_items" }

