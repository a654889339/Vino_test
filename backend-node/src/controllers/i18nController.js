const I18nText = require('../models/I18nText');

exports.list = async (req, res) => {
  try {
    const items = await I18nText.findAll({ order: [['key', 'ASC']] });
    res.json({ code: 0, data: items });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

exports.bulkUpsert = async (req, res) => {
  try {
    const rows = req.body.rows;
    if (!Array.isArray(rows)) return res.status(400).json({ code: 1, message: 'rows required' });
    for (const r of rows) {
      if (!r.key) continue;
      const [item, created] = await I18nText.findOrCreate({
        where: { key: r.key },
        defaults: { zh: r.zh || '', en: r.en || '' },
      });
      if (!created) {
        const upd = {};
        if (r.zh !== undefined) upd.zh = r.zh;
        if (r.en !== undefined) upd.en = r.en;
        if (Object.keys(upd).length) await item.update(upd);
      }
    }
    const items = await I18nText.findAll({ order: [['key', 'ASC']] });
    res.json({ code: 0, data: items });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const item = await I18nText.findByPk(req.params.id);
    if (!item) return res.status(404).json({ code: 1, message: 'not found' });
    const { zh, en } = req.body;
    if (zh !== undefined) item.zh = zh;
    if (en !== undefined) item.en = en;
    await item.save();
    res.json({ code: 0, data: item });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await I18nText.findByPk(req.params.id);
    if (!item) return res.status(404).json({ code: 1, message: 'not found' });
    await item.destroy();
    res.json({ code: 0, message: 'deleted' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};
