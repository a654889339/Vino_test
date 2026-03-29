const sequelize = require('../config/database');

const APP_SET = new Set(['toc', 'outlet', 'mp']);

function normalizePath(p) {
  if (p == null || typeof p !== 'string') return '/';
  let s = p.trim();
  if (!s) return '/';
  if (s.length > 500) s = s.slice(0, 500);
  return s;
}

/** 公开：记录一次页面访问（按日汇总） */
exports.recordPageView = async (req, res) => {
  try {
    let app = (req.body && req.body.app) || 'toc';
    if (typeof app !== 'string' || !APP_SET.has(app)) app = 'toc';
    const path = normalizePath(req.body && req.body.path);
    const pageKey = `${app}:${path}`;
    const visitDate = new Date().toISOString().slice(0, 10);

    await sequelize.query(
      `INSERT INTO page_visit_daily (page_key, visit_date, count, created_at, updated_at)
       VALUES (:pageKey, :visitDate, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE count = count + 1, updated_at = NOW()`,
      { replacements: { pageKey, visitDate } }
    );

    res.json({ code: 0, message: 'ok' });
  } catch (e) {
    console.error('[Analytics] recordPageView:', e.message);
    res.status(500).json({ code: 1, message: '记录失败' });
  }
};

/** 管理端：各页面总访问量与近 7/30/90 日 */
exports.getPageVisitStats = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT page_key AS pageKey,
        SUM(\`count\`) AS total,
        SUM(CASE WHEN visit_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN \`count\` ELSE 0 END) AS d7,
        SUM(CASE WHEN visit_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) THEN \`count\` ELSE 0 END) AS d30,
        SUM(CASE WHEN visit_date >= DATE_SUB(CURDATE(), INTERVAL 89 DAY) THEN \`count\` ELSE 0 END) AS d90
       FROM page_visit_daily
       GROUP BY page_key
       HAVING SUM(\`count\`) > 0
       ORDER BY total DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const list = (rows || []).map((r) => ({
      pageKey: r.pageKey || r.page_key,
      total: Number(r.total) || 0,
      last7Days: Number(r.d7) || 0,
      last30Days: Number(r.d30) || 0,
      lastQuarter: Number(r.d90) || 0,
    }));

    res.json({ code: 0, data: { rows: list } });
  } catch (e) {
    console.error('[Analytics] getPageVisitStats:', e.message);
    res.status(500).json({ code: 1, message: e.message || '查询失败' });
  }
};
