package configdata

import (
	_ "embed"
	"encoding/json"
	"log"
)

//go:embed media_asset_catalog.json
var mediaAssetCatalogRaw []byte

func init() {
	var v any
	if err := json.Unmarshal(mediaAssetCatalogRaw, &v); err != nil {
		log.Fatalf("configdata: invalid media_asset_catalog.json: %v", err)
	}
}

// MediaAssetCatalogJSON returns the embedded catalog bytes (valid JSON).
func MediaAssetCatalogJSON() []byte {
	return mediaAssetCatalogRaw
}
