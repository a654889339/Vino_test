package services

import (
	"fmt"
	"strings"

	"vino/backend/internal/vinomediacfg"
)

func frontPageRoot() (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	root := strings.Trim(strings.TrimSpace(f.FrontPageConfig.Root), "/")
	if root == "" {
		return "", fmt.Errorf("frontPageConfig.Root 不能为空")
	}
	return root, nil
}

func renderTemplateStrict(tpl string, vars map[string]string, requiredPlaceholders ...string) (string, error) {
	t := strings.TrimSpace(tpl)
	if t == "" {
		return "", fmt.Errorf("template 不能为空")
	}
	for _, k := range requiredPlaceholders {
		ph := "{" + k + "}"
		if !strings.Contains(t, ph) {
			return "", fmt.Errorf("template 缺少占位符 %s", ph)
		}
	}
	out := t
	for k, v := range vars {
		out = strings.ReplaceAll(out, "{"+k+"}", v)
	}
	out = strings.TrimLeft(out, "/")
	if out == "" {
		return "", fmt.Errorf("template 渲染结果为空")
	}
	if strings.Contains(out, "..") || strings.Contains(out, "\\") {
		return "", fmt.Errorf("template 渲染结果非法")
	}
	return out, nil
}

func buildFrontPageKey(rel string) (string, error) {
	root, err := frontPageRoot()
	if err != nil {
		return "", err
	}
	r := strings.TrimLeft(strings.TrimSpace(rel), "/")
	if r == "" {
		return "", fmt.Errorf("relative key empty")
	}
	return root + "/" + r, nil
}

func FrontPageHomepageCarouselKey(id, lang string) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.HomepageCarouselTemplate,
		map[string]string{"id": strings.TrimSpace(id), "lang": strings.TrimSpace(lang)},
		"id", "lang",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageLogoKey(lang string) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.Logo,
		map[string]string{"lang": strings.TrimSpace(lang)},
		"lang",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageCategoryCoverKey(categoryID int, lang string) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.CategoryCoverTemplate,
		map[string]string{"category_id": fmt.Sprintf("%d", categoryID), "lang": strings.TrimSpace(lang)},
		"category_id", "lang",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageCorporateCultureKey(lang string) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.CorporateCulture,
		map[string]string{"lang": strings.TrimSpace(lang)},
		"lang",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageProductIconKey(productID int, lang string) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.ProductIconTemplate,
		map[string]string{"product_id": fmt.Sprintf("%d", productID), "lang": strings.TrimSpace(lang)},
		"product_id", "lang",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageProductCoverKey(productID int, lang string) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.ProductCoverTemplate,
		map[string]string{"product_id": fmt.Sprintf("%d", productID), "lang": strings.TrimSpace(lang)},
		"product_id", "lang",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageProductCoverThumbKey(productID int, lang string) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.ProductCoverThumbTemplate,
		map[string]string{"product_id": fmt.Sprintf("%d", productID), "lang": strings.TrimSpace(lang)},
		"product_id", "lang",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageModel3dKey(productID int) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.Model3d,
		map[string]string{"product_id": fmt.Sprintf("%d", productID)},
		"product_id",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageModel3dDecalKey(productID int, lang string) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.Model3dDecal,
		map[string]string{"product_id": fmt.Sprintf("%d", productID), "lang": strings.TrimSpace(lang)},
		"product_id", "lang",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageModel3dSkyBoxKey(productID int) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.Model3dSkyBox,
		map[string]string{"product_id": fmt.Sprintf("%d", productID)},
		"product_id",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

func FrontPageProductDescriptionPdfKey(productID int, lang string) (string, error) {
	f := vinomediacfg.Get()
	if f == nil || f.FrontPageConfig == nil {
		return "", fmt.Errorf("frontPageConfig 未配置")
	}
	rel, err := renderTemplateStrict(
		f.FrontPageConfig.DescriptionPdf,
		map[string]string{"product_id": fmt.Sprintf("%d", productID), "lang": strings.TrimSpace(lang)},
		"product_id", "lang",
	)
	if err != nil {
		return "", err
	}
	return buildFrontPageKey(rel)
}

// UserAvatarKey 返回用户头像 COS object key（userConfig.Root + "/" + 渲染后的 Avatar 模板）。
func UserAvatarKey(userID int) (string, error) {
	if userID <= 0 {
		return "", fmt.Errorf("invalid user id")
	}
	f := vinomediacfg.Get()
	if f == nil || f.UserConfig == nil {
		return "", fmt.Errorf("userConfig 未配置")
	}
	root := strings.Trim(strings.TrimSpace(f.UserConfig.Root), "/")
	if root == "" {
		return "", fmt.Errorf("userConfig.Root 不能为空")
	}
	rel, err := renderTemplateStrict(
		strings.TrimSpace(f.UserConfig.Avatar),
		map[string]string{"userid": fmt.Sprintf("%d", userID)},
		"userid",
	)
	if err != nil {
		return "", err
	}
	return root + "/" + rel, nil
}

