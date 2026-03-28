/**
 * 一次性清理：移除已下线的首页「自助服务」「服务产品」相关 home_config / outlet_home_config 记录。
 * 在服务器上执行：docker exec vino-backend node src/scripts/deleteRemovedHomeSections.js
 */
require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const HomeConfig = require('../models/HomeConfig');
const OutletHomeConfig = require('../models/OutletHomeConfig');

const SECTIONS = ['hotService', 'recommend', 'hotServiceTitle', 'recommendTitle'];

async function main() {
  await sequelize.authenticate();
  const mainRows = await HomeConfig.destroy({ where: { section: { [Op.in]: SECTIONS } } });
  const mainSkin = await HomeConfig.destroy({
    where: { section: 'homeSectionSkin', path: 'hotService' },
  });
  const outRows = await OutletHomeConfig.destroy({ where: { section: { [Op.in]: SECTIONS } } });
  const outSkin = await OutletHomeConfig.destroy({
    where: { section: 'homeSectionSkin', path: 'hotService' },
  });
  console.log(
    JSON.stringify(
      {
        home_configs_removed: mainRows,
        home_configs_skin_hotService_removed: mainSkin,
        outlet_home_configs_removed: outRows,
        outlet_home_configs_skin_hotService_removed: outSkin,
      },
      null,
      2
    )
  );
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
