package handlers

import (
	"encoding/json"

	"vino/backend/internal/configdata"
	"vino/backend/internal/resp"

	"github.com/gin-gonic/gin"
)

// adminMediaAssetCatalog GET /api/admin/media-asset-catalog
func adminMediaAssetCatalog(c *gin.Context) {
	var data any
	if err := json.Unmarshal(configdata.MediaAssetCatalogJSON(), &data); err != nil {
		resp.Err(c, 500, 500, "内置媒体规则表损坏")
		return
	}
	resp.OK(c, data)
}
