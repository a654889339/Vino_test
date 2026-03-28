/**
 * 一次性：为 product_categories 增加 thumbnail_url 列（产品页分类横幅图）。
 * 在服务器容器内执行（已存在列时会跳过）：
 *   docker exec vino-backend node src/scripts/addProductCategoryThumbnailColumn.js
 */
const sequelize = require('../config/database');

(async () => {
  try {
    await sequelize.query(
      'ALTER TABLE product_categories ADD COLUMN thumbnail_url VARCHAR(1024) NULL COMMENT \'分类页横幅缩略图\''
    );
    console.log('[OK] Column thumbnail_url added.');
  } catch (e) {
    const msg = e && e.message ? String(e.message) : '';
    if (msg.includes('Duplicate column') || msg.includes('already exists')) {
      console.log('[OK] Column thumbnail_url already exists, skip.');
    } else {
      console.error(e);
      process.exit(1);
    }
  } finally {
    await sequelize.close();
  }
  process.exit(0);
})();
