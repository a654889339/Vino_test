package models

// Versioned gives every persisted business table a row-level version column.
// It starts at 0 and is reserved for future read-time compatibility upgrades.
type Versioned struct {
	Version int `gorm:"column:version;not null;default:0" json:"version"`
}
