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
	homepageCarouselByLang map[string][]string
	homepageCarouselItems  []models.FrontPageConfigHomepageCarousel
}

var (
	frontPageCfgMu   sync.RWMutex
	frontPageCfgMemo = frontPageCfgSnapshot{homepageCarouselByLang: map[string][]string{}, homepageCarouselItems: nil}
)

func normalizeFrontPageLang(lang string) (string, error) {
	v := strings.TrimSpace(lang)
	if v != "zh" && v != "en" {
		return "", errors.New("language 必须为 zh 或 en")
	}
	return v, nil
}

func requireFrontPageLang(c *gin.Context) (string, bool) {
	lang, err := normalizeFrontPageLang(c.Query("lang"))
	if err != nil {
		resp.Err(c, http.StatusBadRequest, 1, err.Error())
		return "", false
	}
	return lang, true
}

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
	var rows []models.FrontPageConfigHomepageCarousel
	if err := db.DB.Model(&models.FrontPageConfigHomepageCarousel{}).Select("`key`, `language`").Order("`language` ASC, `key` ASC").Find(&rows).Error; err != nil {
		return err
	}
	byLang := map[string][]string{"zh": {}, "en": {}}
	seen := map[string]map[string]bool{"zh": {}, "en": {}}
	items := make([]models.FrontPageConfigHomepageCarousel, 0, len(rows))
	for _, row := range rows {
		key := strings.TrimSpace(row.Key)
		lang, err := normalizeFrontPageLang(row.Language)
		if key == "" {
			return errors.New("frontPageConfig_HomepageCarousel 存在空 key")
		}
		if err != nil {
			return errors.New("frontPageConfig_HomepageCarousel 存在非法 language: " + row.Language)
		}
		if !seen[lang][key] {
			seen[lang][key] = true
			byLang[lang] = append(byLang[lang], key)
			items = append(items, models.FrontPageConfigHomepageCarousel{Key: key, Language: lang})
		}
	}
	sort.Strings(byLang["zh"])
	sort.Strings(byLang["en"])
	sort.Slice(items, func(i, j int) bool {
		if items[i].Language == items[j].Language {
			return items[i].Key < items[j].Key
		}
		return items[i].Language < items[j].Language
	})
	frontPageCfgMu.Lock()
	frontPageCfgMemo.homepageCarouselByLang = byLang
	frontPageCfgMemo.homepageCarouselItems = items
	frontPageCfgMu.Unlock()
	return nil
}

func frontPageHomepageIDsSnapshot(lang string) []string {
	frontPageCfgMu.RLock()
	defer frontPageCfgMu.RUnlock()
	ids := frontPageCfgMemo.homepageCarouselByLang[lang]
	if len(ids) == 0 {
		return []string{}
	}
	return append([]string(nil), ids...)
}

func frontPageHomepageItemsSnapshot() []models.FrontPageConfigHomepageCarousel {
	frontPageCfgMu.RLock()
	defer frontPageCfgMu.RUnlock()
	return append([]models.FrontPageConfigHomepageCarousel(nil), frontPageCfgMemo.homepageCarouselItems...)
}

func frontPageHomepageCarouselUpsertKey(k, lang string) error {
	key := strings.TrimSpace(k)
	if key == "" {
		return errors.New("key empty")
	}
	language, err := normalizeFrontPageLang(lang)
	if err != nil {
		return err
	}
	if err := db.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.FrontPageConfigHomepageCarousel{Key: key, Language: language}).Error; err != nil {
		return err
	}
	frontPageCfgMu.Lock()
	defer frontPageCfgMu.Unlock()
	if frontPageCfgMemo.homepageCarouselByLang == nil {
		frontPageCfgMemo.homepageCarouselByLang = map[string][]string{"zh": {}, "en": {}}
	}
	for _, it := range frontPageCfgMemo.homepageCarouselByLang[language] {
		if it == key {
			return nil
		}
	}
	frontPageCfgMemo.homepageCarouselByLang[language] = append(frontPageCfgMemo.homepageCarouselByLang[language], key)
	sort.Strings(frontPageCfgMemo.homepageCarouselByLang[language])
	frontPageCfgMemo.homepageCarouselItems = append(frontPageCfgMemo.homepageCarouselItems, models.FrontPageConfigHomepageCarousel{Key: key, Language: language})
	sort.Slice(frontPageCfgMemo.homepageCarouselItems, func(i, j int) bool {
		if frontPageCfgMemo.homepageCarouselItems[i].Language == frontPageCfgMemo.homepageCarouselItems[j].Language {
			return frontPageCfgMemo.homepageCarouselItems[i].Key < frontPageCfgMemo.homepageCarouselItems[j].Key
		}
		return frontPageCfgMemo.homepageCarouselItems[i].Language < frontPageCfgMemo.homepageCarouselItems[j].Language
	})
	return nil
}

func frontPageHomepageCarouselDeleteKey(k, lang string) error {
	key := strings.TrimSpace(k)
	if key == "" {
		return errors.New("key empty")
	}
	language, err := normalizeFrontPageLang(lang)
	if err != nil {
		return err
	}
	if err := db.DB.Where("`key` = ? AND `language` = ?", key, language).Delete(&models.FrontPageConfigHomepageCarousel{}).Error; err != nil {
		return err
	}
	frontPageCfgMu.Lock()
	defer frontPageCfgMu.Unlock()
	out := frontPageCfgMemo.homepageCarouselByLang[language][:0]
	for _, it := range frontPageCfgMemo.homepageCarouselByLang[language] {
		if it != key {
			out = append(out, it)
		}
	}
	frontPageCfgMemo.homepageCarouselByLang[language] = out
	items := frontPageCfgMemo.homepageCarouselItems[:0]
	for _, it := range frontPageCfgMemo.homepageCarouselItems {
		if !(it.Key == key && it.Language == language) {
			items = append(items, it)
		}
	}
	frontPageCfgMemo.homepageCarouselItems = items
	return nil
}

// Homepage returns homepage carousel ids for clients.
func Homepage(c *gin.Context) {
	c.Writer.Header().Set("Cache-Control", "no-store")
	lang, ok := requireFrontPageLang(c)
	if !ok {
		return
	}
	resp.OK(c, gin.H{"ids": frontPageHomepageIDsSnapshot(lang)})
}

// AdminHomepageCarouselList returns the id list.
func AdminHomepageCarouselList(c *gin.Context) {
	resp.OK(c, gin.H{"items": frontPageHomepageItemsSnapshot()})
}

// AdminHomepageCarouselAdd adds a key (id).
func AdminHomepageCarouselAdd(c *gin.Context) {
	var body struct {
		Key      string `json:"key"`
		Language string `json:"language"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 1, "参数错误")
		return
	}
	if _, err := normalizeFrontPageLang(body.Language); err != nil {
		resp.Err(c, http.StatusBadRequest, 1, err.Error())
		return
	}
	if err := frontPageHomepageCarouselUpsertKey(body.Key, body.Language); err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	resp.OK(c, gin.H{"items": frontPageHomepageItemsSnapshot()})
}

// AdminHomepageCarouselDelete deletes a key (id).
func AdminHomepageCarouselDelete(c *gin.Context) {
	key := c.Param("key")
	lang, ok := requireFrontPageLang(c)
	if !ok {
		return
	}
	if err := frontPageHomepageCarouselDeleteKey(key, lang); err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	resp.OK(c, gin.H{"items": frontPageHomepageItemsSnapshot()})
}

var errOnlyPNG = errors.New("仅支持 PNG 图片")

// AdminHomepageCarouselUpload uploads image to fixed COS key: {Root}/{HomepageCarousel}/{id}_{language}.png
func AdminHomepageCarouselUpload(c *gin.Context) {
	key := strings.TrimSpace(c.Param("key"))
	if key == "" {
		resp.Err(c, 400, 1, "key 不能为空")
		return
	}
	lang, err := normalizeFrontPageLang(c.PostForm("language"))
	if err != nil {
		resp.Err(c, http.StatusBadRequest, 1, err.Error())
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
	if err := frontPageHomepageCarouselUpsertKey(key, lang); err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}

	filename := key + "_" + lang + ".png"
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
		"url":   urlu,
		"items": frontPageHomepageItemsSnapshot(),
	})
}
