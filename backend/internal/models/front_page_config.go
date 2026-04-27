package models

// FrontPageConfigHomepageCarousel 存储首页轮播图的 id + language 列表（key 即轮播图 id）。
// 表名按产品约定固定为 frontPageConfig_HomepageCarousel。
type FrontPageConfigHomepageCarousel struct {
	Key      string `gorm:"column:key;primaryKey;size:64" json:"key"`
	Language string `gorm:"column:language;size:8" json:"language"`
}

func (FrontPageConfigHomepageCarousel) TableName() string { return "frontPageConfig_HomepageCarousel" }
