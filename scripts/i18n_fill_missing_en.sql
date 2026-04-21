-- =========================================================================
-- Vino_test · 补齐数据库里缺失的英文字段
-- 仅更新 IFNULL(fieldEn,'')='' 或当前值为占位符的行，已有正常英文翻译不覆盖。
-- 执行前建议先 dump，备份已有 /更新发布 流程中的"db备份"工具生成的 db_save/*.sql.gz。
-- =========================================================================
USE vino_db;
SET NAMES utf8mb4;
SET SESSION character_set_results = utf8mb4;

-- ====== product_categories ======
-- id=2 当前 nameEn='Chushiji'（拼音，不规范），修正为标准英文
UPDATE product_categories SET nameEn='Dehumidifier'              WHERE id=2 AND nameEn='Chushiji';
UPDATE product_categories SET nameEn='Solar Energy Storage System' WHERE id=3 AND IFNULL(nameEn,'')='';
UPDATE product_categories SET nameEn='Photovoltaic Transformer'    WHERE id=4 AND IFNULL(nameEn,'')='';
UPDATE product_categories SET nameEn='Inverter'                    WHERE id=5 AND IFNULL(nameEn,'')='';

-- ====== service_categories ======
-- 4 行 nameEn 都是占位符 'English'，全部替换
UPDATE service_categories SET nameEn='Products'                 WHERE id=1 AND (nameEn='English' OR IFNULL(nameEn,'')='');
UPDATE service_categories SET nameEn='Cleaning & Maintenance'   WHERE id=2 AND nameEn='English';
UPDATE service_categories SET nameEn='After-sales & Repair'     WHERE id=3 AND nameEn='English';
UPDATE service_categories SET nameEn='Quick Help'               WHERE id=4 AND nameEn='English';

-- ====== device_guides.nameEn (22 rows) ======
UPDATE device_guides SET nameEn='Solar Storage System I'                   WHERE id= 8 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Photovoltaic Transformer'                 WHERE id= 9 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Inverter'                                 WHERE id=10 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Multi-Split Central Air Conditioner'      WHERE id=11 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Zhifeng Air Conditioner'                  WHERE id=15 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='VRF Air Conditioner'                      WHERE id=16 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Solar-Powered Air Conditioner'            WHERE id=17 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Multi-Pipe Multi-Split Air Conditioner'   WHERE id=18 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Central Dehumidifier 70L'                 WHERE id=24 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Central Dehumidifier 70L'                 WHERE id=25 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Specialty Air Conditioner'                WHERE id=26 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Specialty Air Conditioner (White)'        WHERE id=27 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Ceiling Cassette Air Conditioner'         WHERE id=28 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Central Fresh-Air Dehumidifier 90L'       WHERE id=29 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Central Fresh-Air Dehumidifier (White)'   WHERE id=30 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Solar Storage System II'                  WHERE id=31 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Solar Storage System III'                 WHERE id=32 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Energy Storage Air Conditioner'           WHERE id=33 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Water/Ground Source Heat Pump'            WHERE id=34 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Water/Ground Source Heat Pump (Black)'    WHERE id=35 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Modular Chiller'                          WHERE id=36 AND IFNULL(nameEn,'')='';
UPDATE device_guides SET nameEn='Zhifeng Air Conditioner (Glossy)'         WHERE id=39 AND IFNULL(nameEn,'')='';

-- ====== device_guides.subtitleEn (8 rows) ======
UPDATE device_guides SET subtitleEn='Residential Solar Storage Solution' WHERE id= 8 AND IFNULL(subtitleEn,'')='';
UPDATE device_guides SET subtitleEn='PV Power & Transformer Equipment'   WHERE id= 9 AND IFNULL(subtitleEn,'')='';
UPDATE device_guides SET subtitleEn='PV / Energy Storage Inverter'       WHERE id=10 AND IFNULL(subtitleEn,'')='';
UPDATE device_guides SET subtitleEn='Central Air-Conditioning'           WHERE id=11 AND IFNULL(subtitleEn,'')='';
UPDATE device_guides SET subtitleEn='Residential Air Conditioner'        WHERE id=16 AND IFNULL(subtitleEn,'')='';
UPDATE device_guides SET subtitleEn='Residential Air Conditioner'        WHERE id=17 AND IFNULL(subtitleEn,'')='';
UPDATE device_guides SET subtitleEn='Residential Solar Storage Solution' WHERE id=31 AND IFNULL(subtitleEn,'')='';
UPDATE device_guides SET subtitleEn='Residential Solar Storage Solution' WHERE id=32 AND IFNULL(subtitleEn,'')='';

-- ====== services.titleEn / descriptionEn (7 rows) ======
UPDATE services SET titleEn='Remote Support',          descriptionEn='Online video guidance and remote issue diagnosis.'                       WHERE id= 3 AND IFNULL(titleEn,'')='';
UPDATE services SET titleEn='Deep Cleaning',           descriptionEn='Thorough cleaning and maintenance for a fresh look.'                     WHERE id= 4 AND IFNULL(titleEn,'')='';
UPDATE services SET titleEn='Regular Cleaning',        descriptionEn='Basic upkeep cleaning to keep your device in good shape.'                WHERE id= 5 AND IFNULL(titleEn,'')='';
UPDATE services SET titleEn='Full Inspection',         descriptionEn='Comprehensive system assessment to detect potential issues.'             WHERE id= 6 AND IFNULL(titleEn,'')='';
UPDATE services SET titleEn='Performance Optimization',descriptionEn='Speed boost and upgrades to optimize system performance.'                WHERE id= 7 AND IFNULL(titleEn,'')='';
UPDATE services SET titleEn='Getting Started Guide',   descriptionEn='Tutorials for dehumidifiers, air conditioners, heat pumps and more.'     WHERE id=10 AND IFNULL(titleEn,'')='';
UPDATE services SET titleEn='FAQ',                     descriptionEn='Frequently asked questions.'                                             WHERE id=11 AND IFNULL(titleEn,'')='';

-- ====== home_configs.titleEn / descEn ======
-- banner
UPDATE home_configs SET titleEn='Vino Quality Service',   descEn='Professional · Efficient · Trusted' WHERE id=1 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='New User Offer',         descEn='CN¥20 off your first order'         WHERE id=2 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Enterprise Solutions',   descEn='Customized one-stop service'        WHERE id=3 AND IFNULL(titleEn,'')='';

-- nav (只补 titleEn，descEn 原本就空)
UPDATE home_configs SET titleEn='All Services' WHERE id= 4 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Book'         WHERE id= 5 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Repair'       WHERE id= 6 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Consult'      WHERE id= 7 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Install'      WHERE id= 8 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Maintenance'  WHERE id= 9 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Inspect'      WHERE id=10 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='More'         WHERE id=11 AND IFNULL(titleEn,'')='';

-- vinoProduct (title 兜底；实际会被关联 guide 的 nameEn 覆盖)
UPDATE home_configs SET titleEn='Zhifeng Air Conditioner'                    WHERE id=41 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Solar-Powered Air Conditioner'              WHERE id=42 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Multi-Split Central Air Conditioner'        WHERE id=43 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Multi-Pipe Multi-Split Air Conditioner'     WHERE id=44 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='VINO Smart Inverter Dehumidifier 30L'       WHERE id=61 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='VINO Smart Inverter Dehumidifier 40L'       WHERE id=62 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='1.5-3PH Wall Mounted Split Air Conditioner' WHERE id=63 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='VINO Smart Dehumidifier 16L (Knob)'         WHERE id=65 AND IFNULL(titleEn,'')='';

-- featuredRecommend (title + desc)
UPDATE home_configs SET titleEn='Zhifeng Air Conditioner',                    descEn='Home & Commercial Central AC' WHERE id=50 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Multi-Split Central Air Conditioner',        descEn='Central Air-Conditioning'     WHERE id=52 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='1.5-3PH Wall Mounted Split Air Conditioner'                                        WHERE id=53 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Smart Inverter Dehumidifier 40L'                                                   WHERE id=69 AND IFNULL(titleEn,'')='';
UPDATE home_configs SET titleEn='Smart Inverter Dehumidifier 30L',            descEn='Home & Industrial Dehumidification' WHERE id=70 AND IFNULL(titleEn,'')='';

-- ====== i18n_texts 空 en (2 rows) ======
UPDATE i18n_texts SET en='Total' WHERE `key`='manual.chapterCountPrefix'       AND IFNULL(en,'')='';
UPDATE i18n_texts SET en='Total' WHERE `key`='maintenance.sectionCountPrefix'  AND IFNULL(en,'')='';

-- =========================================================================
-- 核对：应该全部为 0 或大幅减少
-- =========================================================================
SELECT 'product_categories' AS tbl, COUNT(*) AS still_missing FROM product_categories WHERE IFNULL(nameEn,'')='' OR nameEn='Chushiji'
UNION ALL SELECT 'service_categories', COUNT(*) FROM service_categories WHERE IFNULL(nameEn,'')='' OR nameEn='English'
UNION ALL SELECT 'device_guides.nameEn', COUNT(*) FROM device_guides WHERE IFNULL(nameEn,'')=''
UNION ALL SELECT 'device_guides.subtitleEn', COUNT(*) FROM device_guides WHERE IFNULL(subtitle,'')<>'' AND IFNULL(subtitleEn,'')=''
UNION ALL SELECT 'services.titleEn', COUNT(*) FROM services WHERE IFNULL(titleEn,'')=''
UNION ALL SELECT 'services.descriptionEn', COUNT(*) FROM services WHERE IFNULL(description,'')<>'' AND IFNULL(descriptionEn,'')=''
UNION ALL SELECT 'home_configs.banner.titleEn', COUNT(*) FROM home_configs WHERE section='banner' AND IFNULL(titleEn,'')=''
UNION ALL SELECT 'home_configs.nav.titleEn', COUNT(*) FROM home_configs WHERE section='nav' AND IFNULL(titleEn,'')=''
UNION ALL SELECT 'home_configs.featuredRecommend.titleEn', COUNT(*) FROM home_configs WHERE section='featuredRecommend' AND IFNULL(titleEn,'')=''
UNION ALL SELECT 'home_configs.vinoProduct.titleEn', COUNT(*) FROM home_configs WHERE section='vinoProduct' AND IFNULL(titleEn,'')=''
UNION ALL SELECT 'i18n_texts.en', COUNT(*) FROM i18n_texts WHERE IFNULL(en,'')='';
