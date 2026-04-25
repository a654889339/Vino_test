package services

import (
	"sync"
	"time"

	"vino/backend/internal/db"
	"vino/backend/internal/models"
)

// Feature flags are stored in home_configs:
// - section = "featureFlag"
// - path = flag key (e.g. maintenanceMode)
// - status = active|inactive (enabled when active)
//
// This avoids schema changes and lets admin UI manage flags.

const (
	FeatureFlagSection = "featureFlag"

	FlagMaintenanceMode   = "maintenanceMode"
	FlagEnableRegister    = "enableRegister"
	FlagEnableCreateOrder = "enableCreateOrder"
	FlagEnableGoodsOrder  = "enableCreateGoodsOrder"
	FlagEnableCreateAddr  = "enableCreateAddress"
)

type FeatureFlags struct {
	MaintenanceMode   bool              `json:"maintenanceMode"`
	EnableRegister    bool              `json:"enableRegister"`
	EnableCreateOrder bool              `json:"enableCreateOrder"`
	EnableGoodsOrder  bool              `json:"enableCreateGoodsOrder"`
	EnableCreateAddr  bool              `json:"enableCreateAddress"`
	All              map[string]bool    `json:"all,omitempty"`
	UpdatedAtUnixMs  int64              `json:"updatedAtUnixMs,omitempty"`
	Raw              []models.HomeConfig `json:"-"`
}

type featureFlagsCache struct {
	mu     sync.Mutex
	until  time.Time
	flags  FeatureFlags
	loaded bool
}

var ffCache featureFlagsCache

func defaultFeatureFlags() FeatureFlags {
	// Default: everything enabled, not in maintenance.
	return FeatureFlags{
		MaintenanceMode:   false,
		EnableRegister:    true,
		EnableCreateOrder: true,
		EnableGoodsOrder:  true,
		EnableCreateAddr:  true,
	}
}

func InvalidateFeatureFlags() {
	ffCache.mu.Lock()
	defer ffCache.mu.Unlock()
	ffCache.until = time.Time{}
	ffCache.loaded = false
	ffCache.flags = FeatureFlags{}
}

func GetFeatureFlags() FeatureFlags {
	return GetFeatureFlagsWithTTL(5 * time.Second)
}

func GetFeatureFlagsWithTTL(ttl time.Duration) FeatureFlags {
	now := time.Now()
	ffCache.mu.Lock()
	if ffCache.loaded && now.Before(ffCache.until) {
		out := ffCache.flags
		ffCache.mu.Unlock()
		return out
	}
	ffCache.mu.Unlock()

	flags := defaultFeatureFlags()
	var rows []models.HomeConfig
	if db.DB != nil {
		// Only need these columns.
		_ = db.DB.
			Select("id", "section", "path", "status", "updatedAt").
			Where("section = ?", FeatureFlagSection).
			Find(&rows).Error
	}
	byKey := map[string]bool{}
	var updatedAt time.Time
	for _, r := range rows {
		key := r.Path
		if key == "" {
			continue
		}
		enabled := r.Status == "active"
		byKey[key] = enabled
		if r.UpdatedAt.After(updatedAt) {
			updatedAt = r.UpdatedAt
		}
	}
	if v, ok := byKey[FlagMaintenanceMode]; ok {
		flags.MaintenanceMode = v
	}
	if v, ok := byKey[FlagEnableRegister]; ok {
		flags.EnableRegister = v
	}
	if v, ok := byKey[FlagEnableCreateOrder]; ok {
		flags.EnableCreateOrder = v
	}
	if v, ok := byKey[FlagEnableGoodsOrder]; ok {
		flags.EnableGoodsOrder = v
	}
	if v, ok := byKey[FlagEnableCreateAddr]; ok {
		flags.EnableCreateAddr = v
	}
	flags.All = byKey
	if !updatedAt.IsZero() {
		flags.UpdatedAtUnixMs = updatedAt.UnixMilli()
	}

	ffCache.mu.Lock()
	ffCache.loaded = true
	ffCache.until = now.Add(ttl)
	ffCache.flags = flags
	ffCache.mu.Unlock()
	return flags
}

