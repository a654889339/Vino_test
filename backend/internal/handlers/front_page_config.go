package handlers

import (
	"errors"
	"io"
	"net/http"
	"path"
	"sort"
	"strings"
	"sync"

	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"
	"vino/backend/internal/services"
	"vino/backend/internal/vinomediacfg"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

type frontPageCfgSnapshot struct {
	homepageCarouselIDs []string
}

var (
	frontPageCfgMu   sync.RWMutex
	frontPageCfgMemo = frontPageCfgSnapshot{homepageCarouselIDs: nil}
)

func frontPageCfgRootAndHomepageCarousel() (root, carousel string) {
	// defaults
	root = "front_page_config"
	carousel = "Homepagecarousel"
	// vino.media.yaml may not contain the fields (older versions)
	if f := vinomediacfg.Get(); f != nil {
		if f.FrontPageConfig != nil {
			if s := strings.TrimSpace(f.FrontPageConfig.Root); s != "" {
				root = s
			}
			if s := strings.TrimSpace(f.FrontPageConfig.HomepageCarousel); s != "" {
				carousel = s
			}
		}
	}
	root = strings.Trim(root, "/")
	carousel = strings.Trim(carousel, "/")
	return root, carousel
}

func frontPageHomepageCarouselPrefix() string {
	root, carousel := frontPageCfgRootAndHomepageCarousel()
	if root == "" {
		return ""
	}
	if carousel == "" {
		return root
	}
	return root + "/" + carousel
}

// InitFrontPageConfigCache should be called after DB is connected.
func InitFrontPageConfigCache() error {
	var keys []string
	if err := db.DB.Model(&models.FrontPageConfigHomepageCarousel{}).Select("`key`").Order("`key` ASC").Pluck("`key`", &keys).Error; err != nil {
		return err
	}
	trimmed := make([]string, 0, len(keys))
	seen := map[string]bool{}
	for _, k := range keys {
		t := strings.TrimSpace(k)
		if t == "" || seen[t] {
			continue
		}
		seen[t] = true
		trimmed = append(trimmed, t)
	}
	sort.Strings(trimmed)
	frontPageCfgMu.Lock()
	frontPageCfgMemo.homepageCarouselIDs = trimmed
	frontPageCfgMu.Unlock()
	return nil
}

func frontPageHomepageIDsSnapshot() []string {
	frontPageCfgMu.RLock()
	defer frontPageCfgMu.RUnlock()
	if len(frontPageCfgMemo.homepageCarouselIDs) == 0 {
		return []string{}
	}
	return append([]string(nil), frontPageCfgMemo.homepageCarouselIDs...)
}

func frontPageHomepageCarouselUpsertKey(k string) error {
	key := strings.TrimSpace(k)
	if key == "" {
		return errors.New("key empty")
	}
	// Upsert into DB (id list)
	if err := db.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.FrontPageConfigHomepageCarousel{Key: key}).Error; err != nil {
		return err
	}
	// Update memory
	frontPageCfgMu.Lock()
	defer frontPageCfgMu.Unlock()
	for _, it := range frontPageCfgMemo.homepageCarouselIDs {
		if it == key {
			return nil
		}
	}
	frontPageCfgMemo.homepageCarouselIDs = append(frontPageCfgMemo.homepageCarouselIDs, key)
	sort.Strings(frontPageCfgMemo.homepageCarouselIDs)
	return nil
}

func frontPageHomepageCarouselDeleteKey(k string) error {
	key := strings.TrimSpace(k)
	if key == "" {
		return errors.New("key empty")
	}
	if err := db.DB.Delete(&models.FrontPageConfigHomepageCarousel{Key: key}).Error; err != nil {
		return err
	}
	frontPageCfgMu.Lock()
	defer frontPageCfgMu.Unlock()
	out := frontPageCfgMemo.homepageCarouselIDs[:0]
	for _, it := range frontPageCfgMemo.homepageCarouselIDs {
		if it != key {
			out = append(out, it)
		}
	}
	frontPageCfgMemo.homepageCarouselIDs = out
	return nil
}

// Homepage returns homepage carousel ids for clients.
func Homepage(c *gin.Context) {
	c.Writer.Header().Set("Cache-Control", "no-store")
	resp.OK(c, gin.H{"ids": frontPageHomepageIDsSnapshot()})
}

// AdminHomepageCarouselList returns the id list.
func AdminHomepageCarouselList(c *gin.Context) {
	resp.OK(c, gin.H{"ids": frontPageHomepageIDsSnapshot()})
}

// AdminHomepageCarouselAdd adds a key (id).
func AdminHomepageCarouselAdd(c *gin.Context) {
	var body struct {
		Key string `json:"key"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 1, "参数错误")
		return
	}
	if err := frontPageHomepageCarouselUpsertKey(body.Key); err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	resp.OK(c, gin.H{"ids": frontPageHomepageIDsSnapshot()})
}

// AdminHomepageCarouselDelete deletes a key (id).
func AdminHomepageCarouselDelete(c *gin.Context) {
	key := c.Param("key")
	if err := frontPageHomepageCarouselDeleteKey(key); err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	resp.OK(c, gin.H{"ids": frontPageHomepageIDsSnapshot()})
}

var errOnlyPNG = errors.New("仅支持 PNG 图片")

// AdminHomepageCarouselUpload uploads image to fixed COS key: {Root}/{HomepageCarousel}/{id}.png
func AdminHomepageCarouselUpload(c *gin.Context) {
	key := strings.TrimSpace(c.Param("key"))
	if key == "" {
		resp.Err(c, 400, 1, "key 不能为空")
		return
	}
	fh, err := c.FormFile("file")
	if err != nil {
		resp.Err(c, 400, 1, "请选择图片文件")
		return
	}
	ext := strings.ToLower(path.Ext(fh.Filename))
	ct := strings.ToLower(strings.TrimSpace(fh.Header.Get("Content-Type")))
	if ext != ".png" && !strings.Contains(ct, "png") {
		resp.Err(c, 400, 1, errOnlyPNG.Error())
		return
	}
	f, err := fh.Open()
	if err != nil {
		resp.Err(c, 500, 1, "读取文件失败")
		return
	}
	defer f.Close()
	buf, err := io.ReadAll(f)
	if err != nil || len(buf) == 0 {
		resp.Err(c, 500, 1, "读取文件失败")
		return
	}

	prefix := frontPageHomepageCarouselPrefix()
	if prefix == "" {
		resp.Err(c, 500, 1, "frontPageConfig 前缀配置缺失")
		return
	}
	// Ensure id exists in table+memory
	if err := frontPageHomepageCarouselUpsertKey(key); err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}

	filename := key + ".png"
	urlu, err := services.UploadCOSWithContentPrefix(c.Request.Context(), buf, filename, "image/png", prefix)
	if err != nil {
		// If COS isn't configured, surface a clearer message for admin.
		if !services.CosConfigured() {
			resp.Err(c, http.StatusBadRequest, 1, "COS 未配置：请设置 COS_SECRET_ID/COS_SECRET_KEY 后重试")
			return
		}
		resp.Err(c, 500, 1, err.Error())
		return
	}
	// Return direct public URL + key list.
	resp.OK(c, gin.H{
		"url": urlu,
		"ids": frontPageHomepageIDsSnapshot(),
	})
}

