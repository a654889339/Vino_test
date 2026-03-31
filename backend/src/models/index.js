const sequelize = require('../config/database');
const User = require('./User');
const Service = require('./Service');
const ServiceCategory = require('./ServiceCategory');
const Order = require('./Order');
const OrderLog = require('./OrderLog');
const Address = require('./Address');
const DeviceGuide = require('./DeviceGuide');
const ProductCategory = require('./ProductCategory');
const HomeConfig = require('./HomeConfig');
const Message = require('./Message');
const InventoryCategory = require('./InventoryCategory');
const InventoryProduct = require('./InventoryProduct');
const UserProduct = require('./UserProduct');
const OutletUser = require('./OutletUser');
const OutletOrder = require('./OutletOrder');
const OutletOrderLog = require('./OutletOrderLog');
const OutletAddress = require('./OutletAddress');
const OutletHomeConfig = require('./OutletHomeConfig');
const OutletMessage = require('./OutletMessage');
const OutletServiceCategory = require('./OutletServiceCategory');
const OutletService = require('./OutletService');
const PageVisitDaily = require('./PageVisitDaily');
const I18nText = require('./I18nText');

ProductCategory.hasMany(DeviceGuide, { foreignKey: 'categoryId', as: 'guides' });
DeviceGuide.belongsTo(ProductCategory, { foreignKey: 'categoryId', as: 'category' });

ServiceCategory.hasMany(Service, { foreignKey: 'categoryId', as: 'services' });
Service.belongsTo(ServiceCategory, { foreignKey: 'categoryId', as: 'serviceCategory' });

OutletServiceCategory.hasMany(OutletService, { foreignKey: 'categoryId', as: 'services' });
OutletService.belongsTo(OutletServiceCategory, { foreignKey: 'categoryId', as: 'serviceCategory' });

InventoryCategory.hasMany(InventoryProduct, { foreignKey: 'categoryId', as: 'products' });
InventoryProduct.belongsTo(InventoryCategory, { foreignKey: 'categoryId', as: 'category' });

User.hasMany(UserProduct, { foreignKey: 'userId', as: 'boundProducts' });
UserProduct.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Order.belongsTo(DeviceGuide, { foreignKey: 'guideId', as: 'guide' });
Order.hasMany(OrderLog, { foreignKey: 'orderId', as: 'logs' });
OrderLog.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Message, { foreignKey: 'userId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'userId', as: 'user' });

OutletUser.hasMany(OutletOrder, { foreignKey: 'userId', as: 'orders' });
OutletOrder.belongsTo(OutletUser, { foreignKey: 'userId', as: 'user' });
OutletOrder.hasMany(OutletOrderLog, { foreignKey: 'orderId', as: 'logs' });
OutletOrderLog.belongsTo(OutletOrder, { foreignKey: 'orderId', as: 'order' });
OutletUser.hasMany(OutletAddress, { foreignKey: 'userId', as: 'addresses' });
OutletAddress.belongsTo(OutletUser, { foreignKey: 'userId', as: 'user' });
OutletUser.hasMany(OutletMessage, { foreignKey: 'userId', as: 'messages' });
OutletMessage.belongsTo(OutletUser, { foreignKey: 'userId', as: 'user' });

const models = { User, Service, ServiceCategory, Order, OrderLog, Address, DeviceGuide, ProductCategory, HomeConfig, Message, InventoryCategory, InventoryProduct, UserProduct, OutletUser, OutletOrder, OutletOrderLog, OutletAddress, OutletHomeConfig, OutletMessage, OutletServiceCategory, OutletService, PageVisitDaily, I18nText };

const ADMIN_PASSWORD = 'Vino@2024admin';

const INDEX_WARN_THRESHOLD = 20;
const INDEX_HARD_LIMIT = 64;

async function cleanDuplicateIndexes() {
  try {
    const [rows] = await sequelize.query(
      `SELECT TABLE_NAME, INDEX_NAME
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND INDEX_NAME != 'PRIMARY'
         AND INDEX_NAME REGEXP '_[0-9]+$'
       GROUP BY TABLE_NAME, INDEX_NAME
       ORDER BY TABLE_NAME, INDEX_NAME`
    );
    if (!rows.length) return;
    console.warn(`[DB-IndexGuard] Found ${rows.length} duplicate index(es), cleaning...`);
    for (const { TABLE_NAME, INDEX_NAME } of rows) {
      try {
        await sequelize.query(`DROP INDEX \`${INDEX_NAME}\` ON \`${TABLE_NAME}\``);
        console.warn(`[DB-IndexGuard] Dropped duplicate index ${TABLE_NAME}.${INDEX_NAME}`);
      } catch (e) {
        console.error(`[DB-IndexGuard] Failed to drop ${TABLE_NAME}.${INDEX_NAME}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('[DB-IndexGuard] cleanDuplicateIndexes error:', e.message);
  }
}

async function checkIndexHealth() {
  try {
    const [rows] = await sequelize.query(
      `SELECT TABLE_NAME, COUNT(DISTINCT INDEX_NAME) AS idx_count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
       GROUP BY TABLE_NAME
       HAVING idx_count >= ${INDEX_WARN_THRESHOLD}
       ORDER BY idx_count DESC`
    );
    for (const { TABLE_NAME, idx_count } of rows) {
      if (idx_count >= INDEX_HARD_LIMIT) {
        console.error(`[DB-IndexGuard] CRITICAL: ${TABLE_NAME} has ${idx_count} indexes (limit ${INDEX_HARD_LIMIT}), attempting auto-cleanup`);
        await cleanDuplicateIndexes();
        return false;
      }
      console.warn(`[DB-IndexGuard] WARNING: ${TABLE_NAME} has ${idx_count} indexes (threshold ${INDEX_WARN_THRESHOLD})`);
    }
    return true;
  } catch (e) {
    console.error('[DB-IndexGuard] checkIndexHealth error:', e.message);
    return true;
  }
}

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connection established successfully.');
    await cleanDuplicateIndexes();
    await sequelize.sync({ alter: true });
    console.log('[DB] All models synchronized.');
    const healthy = await checkIndexHealth();
    if (!healthy) {
      console.error('[DB-IndexGuard] Index anomaly detected after sync, cleaned duplicates. Re-checking...');
      const ok = await checkIndexHealth();
      if (!ok) console.error('[DB-IndexGuard] Index issue persists after cleanup. Manual intervention may be needed.');
    }

    const admin = await User.findOne({ where: { username: 'admin' } });
    if (!admin) {
      await User.create({
        username: 'admin',
        email: 'admin@vino.service',
        password: ADMIN_PASSWORD,
        nickname: '管理员',
        role: 'admin',
      });
      console.log('[DB] Default admin account created.');
    }

    const catCount = await ProductCategory.count();
    if (catCount === 0) {
      await ProductCategory.bulkCreate([
        { name: '空调', sortOrder: 1 },
        { name: '除湿与储能', sortOrder: 2 },
      ]);
      console.log('[DB] Default product categories created.');
    }

    const guideCount = await DeviceGuide.count();
    if (guideCount === 0) {
      const [cat1, cat2] = await ProductCategory.findAll({ order: [['sortOrder', 'ASC']] });
      const seedGuides = [
        { name: '空调', subtitle: '家用/商用中央空调', icon: 'cluster-o', emoji: '❄️', gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', badge: '热门', sortOrder: 1, categoryId: cat1.id },
        { name: '除湿机', subtitle: '家用/工业除湿设备', icon: 'filter-o', emoji: '💧', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)', badge: '', sortOrder: 2, categoryId: cat2.id },
        { name: '光储一体机', subtitle: '户用光储一体解决方案', icon: 'fire-o', emoji: '☀️', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', badge: '新', sortOrder: 3, categoryId: cat2.id },
        { name: '光伏变电器', subtitle: '光伏发电变电设备', icon: 'balance-list-o', emoji: '⚡', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', badge: '', sortOrder: 4, categoryId: cat2.id },
        { name: '逆变器', subtitle: '光伏/储能逆变器', icon: 'replay', emoji: '🔌', gradient: 'linear-gradient(135deg, #10B981, #059669)', badge: '', sortOrder: 5, categoryId: cat2.id },
      ];
      const tagsData = [
        ['制冷维修','清洗保养','加氟充注','安装移机'],
        ['除湿维修','滤网更换','水箱清洁'],
        ['系统检测','电池维护','并网调试'],
        ['变压器检测','绝缘测试','效率优化'],
        ['故障诊断','固件升级','效率优化'],
      ];
      const sectionsData = [
        [{title:'常见故障',icon:'warning-o',tips:['不制冷/制热','漏水滴水','噪音异常','遥控器失灵','频繁启停']},{title:'保养建议',icon:'info-o',tips:['每月清洗滤网','每年专业深度清洗','定期检查制冷剂','室外机保持通风']}],
        [{title:'常见故障',icon:'warning-o',tips:['不除湿','噪音过大','漏水','显示屏异常']},{title:'保养建议',icon:'info-o',tips:['定期清洗滤网','及时排空水箱','保持进出风口通畅']}],
        [{title:'系统组成',icon:'info-o',tips:['光伏组件','储能电池','混合逆变器','智能监控']},{title:'维护要点',icon:'warning-o',tips:['定期检查光伏板清洁度','监控电池健康状态','检查线缆连接','软件系统更新']}],
        [{title:'检测项目',icon:'warning-o',tips:['绝缘电阻测试','变比测试','温升检测','噪声检测']},{title:'维护建议',icon:'info-o',tips:['定期清洁散热装置','检查接线端子','监控运行温度','定期绝缘测试']}],
        [{title:'常见故障',icon:'warning-o',tips:['不并网','功率不足','报错代码','通讯故障']},{title:'维护建议',icon:'info-o',tips:['保持通风散热','定期清洁滤网','检查直流端子','监控发电效率']}],
      ];
      for (let i = 0; i < seedGuides.length; i++) {
        await DeviceGuide.create({ ...seedGuides[i], slug: seedGuides[i].name === '空调' ? 'aircondition' : seedGuides[i].name === '除湿机' ? 'dehumidifier' : seedGuides[i].name === '光储一体机' ? 'solar-storage' : seedGuides[i].name === '光伏变电器' ? 'pv-inverter' : 'inverter', tags: tagsData[i], sections: sectionsData[i] });
      }
      console.log('[DB] Default device guides created.');
    }

    const hcCount = await HomeConfig.count();
    if (hcCount === 0) {
      const seed = [
        { section:'banner', title:'Vino 品质服务', desc:'专业·高效·可信赖', color:'linear-gradient(135deg, #B91C1C, #7F1D1D)', sortOrder:1 },
        { section:'banner', title:'新用户专享', desc:'首单立减 20 元', color:'linear-gradient(135deg, #1E40AF, #1E3A5F)', sortOrder:2 },
        { section:'banner', title:'企业解决方案', desc:'定制化一站式服务', color:'linear-gradient(135deg, #065F46, #064E3B)', sortOrder:3 },
        { section:'nav', title:'全部服务', icon:'apps-o', path:'/services', color:'#B91C1C', sortOrder:1 },
        { section:'nav', title:'预约', icon:'calendar-o', path:'/services', color:'#D97706', sortOrder:2 },
        { section:'nav', title:'维修', icon:'setting-o', path:'/services', color:'#2563EB', sortOrder:3 },
        { section:'nav', title:'咨询', icon:'chat-o', path:'/services', color:'#7C3AED', sortOrder:4 },
        { section:'nav', title:'安装', icon:'logistics', path:'/services', color:'#059669', sortOrder:5 },
        { section:'nav', title:'保养', icon:'shield-o', path:'/services', color:'#DC2626', sortOrder:6 },
        { section:'nav', title:'检测', icon:'scan', path:'/services', color:'#EA580C', sortOrder:7 },
        { section:'nav', title:'更多', icon:'more-o', path:'/services', color:'#6B7280', sortOrder:8 },
        { section:'hotService', title:'设备维修', desc:'专业工程师上门服务', price:'99', icon:'setting-o', color:'linear-gradient(135deg, #B91C1C, #991B1B)', path:'/service/1', sortOrder:1 },
        { section:'hotService', title:'深度清洁', desc:'全方位清洁保养', price:'149', icon:'brush-o', color:'linear-gradient(135deg, #2563EB, #1D4ED8)', path:'/service/2', sortOrder:2 },
        { section:'hotService', title:'系统检测', desc:'全面检测评估', price:'49', icon:'scan', color:'linear-gradient(135deg, #059669, #047857)', path:'/service/3', sortOrder:3 },
        { section:'hotService', title:'数据恢复', desc:'专业数据找回', price:'199', icon:'replay', color:'linear-gradient(135deg, #7C3AED, #6D28D9)', path:'/service/4', sortOrder:4 },
        { section:'recommend', title:'会员权益', desc:'专属折扣', icon:'vip-card-o', color:'linear-gradient(135deg, #F59E0B, #D97706)', sortOrder:1 },
        { section:'recommend', title:'服务保障', desc:'无忧售后', icon:'shield-o', color:'linear-gradient(135deg, #10B981, #059669)', sortOrder:2 },
        { section:'recommend', title:'积分商城', desc:'好礼兑换', icon:'gift-o', color:'linear-gradient(135deg, #EC4899, #DB2777)', sortOrder:3 },
        { section:'recommend', title:'邀请有礼', desc:'分享得佣金', icon:'friends-o', color:'linear-gradient(135deg, #6366F1, #4F46E5)', sortOrder:4 },
      ];
      await HomeConfig.bulkCreate(seed);
      console.log('[DB] Default home configs created.');
    }

    const svcCatCount = await ServiceCategory.count();
    if (svcCatCount === 0) {
      await ServiceCategory.bulkCreate([
        { name: '维修', key: 'repair', sortOrder: 1 },
        { name: '清洁', key: 'clean', sortOrder: 2 },
        { name: '检测', key: 'inspect', sortOrder: 3 },
        { name: '数据', key: 'data', sortOrder: 4 },
      ]);
      console.log('[DB] Default service categories created.');
    }

    const svcCount = await Service.count();
    if (svcCount === 0) {
      const [repair, clean, inspect, data] = await ServiceCategory.findAll({ order: [['sortOrder', 'ASC']] });
      const seedServices = [
        { categoryId: repair.id, title: '设备维修', description: '专业工程师提供全方位维修服务，品质保障，售后无忧。', icon: 'setting-o', price: 99, originPrice: 159, bg: '#B91C1C', sortOrder: 1 },
        { categoryId: repair.id, title: '上门维修', description: '快速响应，工程师2小时内上门服务。', icon: 'location-o', price: 149, originPrice: 199, bg: '#DC2626', sortOrder: 2 },
        { categoryId: repair.id, title: '远程支持', description: '在线视频指导，远程诊断问题。', icon: 'phone-o', price: 29, originPrice: 49, bg: '#EF4444', sortOrder: 3 },
        { categoryId: clean.id, title: '深度清洁', description: '全方位清洁保养，焕然一新。', icon: 'brush-o', price: 149, originPrice: 199, bg: '#2563EB', sortOrder: 1 },
        { categoryId: clean.id, title: '日常清洁', description: '基础维护清洁，保持良好状态。', icon: 'smile-o', price: 69, originPrice: 89, bg: '#3B82F6', sortOrder: 2 },
        { categoryId: inspect.id, title: '全面检测', description: '系统全面评估，发现潜在问题。', icon: 'scan', price: 49, originPrice: 79, bg: '#059669', sortOrder: 1 },
        { categoryId: inspect.id, title: '性能优化', description: '提速升级，优化系统性能。', icon: 'fire-o', price: 79, originPrice: 129, bg: '#10B981', sortOrder: 2 },
        { categoryId: data.id, title: '数据恢复', description: '专业数据找回，高成功率。', icon: 'replay', price: 199, originPrice: 299, bg: '#7C3AED', sortOrder: 1 },
        { categoryId: data.id, title: '数据备份', description: '安全迁移，完整备份保护。', icon: 'description', price: 59, originPrice: 89, bg: '#8B5CF6', sortOrder: 2 },
      ];
      await Service.bulkCreate(seedServices);
      console.log('[DB] Default services created.');
    }

    const i18nCount = await I18nText.count();
    if (i18nCount === 0) {
      const seed = [
        { key: 'tabbar.home', zh: '首页', en: 'Home' },
        { key: 'tabbar.products', zh: '产品', en: 'Products' },
        { key: 'tabbar.services', zh: '服务', en: 'Services' },
        { key: 'tabbar.mine', zh: '我的', en: 'Mine' },
        { key: 'home.selfBook', zh: '自助预约', en: 'Self Booking' },
        { key: 'home.myProducts', zh: '我的商品', en: 'My Products' },
        { key: 'home.vinoProducts', zh: 'Vino产品', en: 'Vino Products' },
        { key: 'home.viewAll', zh: '全部 ›', en: 'All ›' },
        { key: 'home.featured', zh: '甄选推荐', en: 'Featured' },
        { key: 'home.viewMore', zh: '查看全部 ›', en: 'View All ›' },
        { key: 'home.progressQuery', zh: '进度查询 ›', en: 'Track Order ›' },
        { key: 'home.exploreVino', zh: '探索VINO', en: 'Explore VINO' },
        { key: 'home.shareHint', zh: '扫描二维码，打开 Vino 服务站', en: 'Scan QR code to open Vino Service' },
        { key: 'home.copyLink', zh: '复制链接', en: 'Copy Link' },
        { key: 'home.noGuide', zh: '暂无产品指南', en: 'No product guide available' },
        { key: 'home.noProductLink', zh: '未配置商品链接', en: 'Product link not configured' },
        { key: 'home.noJumpLink', zh: '未配置跳转链接', en: 'Jump link not configured' },
        { key: 'home.linkCopied', zh: '链接已复制', en: 'Link copied' },
        { key: 'home.copyFailed', zh: '复制失败，请手动复制', en: 'Copy failed, please copy manually' },
        { key: 'home.qrUnclear', zh: '未能识别二维码，请上传清晰的商品二维码图片', en: 'QR code not recognized, please upload a clearer image' },
        { key: 'home.qrNoSerial', zh: '二维码中未包含序列号，请使用商品绑定二维码', en: 'QR code does not contain a serial number' },
        { key: 'home.bindOk', zh: '绑定成功', en: 'Bound successfully' },
        { key: 'home.bindFailed', zh: '绑定失败', en: 'Binding failed' },
        { key: 'home.bindError', zh: '识别或绑定失败', en: 'Recognition or binding failed' },
        { key: 'lang.zhLabel', zh: '中', en: 'EN' },
        { key: 'lang.zhName', zh: '中文', en: 'Chinese' },
        { key: 'lang.enName', zh: 'English', en: 'English' },
        { key: 'products.searchPlaceholder', zh: '请输入设备型号或系列', en: 'Search device model or series' },
        { key: 'products.emptyNoMatch', zh: '未找到匹配的商品', en: 'No matching products found' },
        { key: 'products.emptyCategoryEmpty', zh: '该种类下暂无商品', en: 'No products in this category' },
        { key: 'products.emptyNoConfig', zh: '暂无商品配置', en: 'No product configuration' },
        { key: 'services.repair', zh: '售后维修', en: 'Repair' },
        { key: 'services.clean', zh: '清洁维养', en: 'Cleaning' },
        { key: 'services.inspect', zh: '检测', en: 'Inspection' },
        { key: 'services.data', zh: '数据', en: 'Data' },
        { key: 'services.deviceRepair', zh: '设备维修', en: 'Device Repair' },
        { key: 'services.onSiteRepair', zh: '上门维修', en: 'On-site Repair' },
        { key: 'services.remoteSupport', zh: '远程支持', en: 'Remote Support' },
        { key: 'services.deepClean', zh: '深度清洁', en: 'Deep Cleaning' },
        { key: 'services.dailyClean', zh: '日常清洁', en: 'Daily Cleaning' },
        { key: 'services.fullInspection', zh: '全面检测', en: 'Full Inspection' },
        { key: 'services.performanceOpt', zh: '性能优化', en: 'Performance Optimization' },
        { key: 'services.dataRecovery', zh: '数据恢复', en: 'Data Recovery' },
        { key: 'services.dataBackup', zh: '数据备份', en: 'Data Backup' },
        { key: 'services.deviceRepairDesc', zh: '专业工程师提供全方位维修服务，品质保障，售后无忧。', en: 'Professional full-range repair service with quality assurance.' },
        { key: 'services.onSiteRepairDesc', zh: '快速响应，工程师2小时内上门服务。', en: 'Fast response, on-site service within 2 hours.' },
        { key: 'services.remoteSupportDesc', zh: '在线视频指导，远程诊断问题。', en: 'Online video guidance and remote diagnosis.' },
        { key: 'services.deepCleanDesc', zh: '全方位清洁保养，焕然一新。', en: 'Comprehensive cleaning and maintenance.' },
        { key: 'services.dailyCleanDesc', zh: '基础维护清洁，保持良好状态。', en: 'Basic maintenance to keep in good condition.' },
        { key: 'services.fullInspectionDesc', zh: '系统全面评估，发现潜在问题。', en: 'Comprehensive system evaluation.' },
        { key: 'services.performanceOptDesc', zh: '提速升级，优化系统性能。', en: 'Speed up and optimize system performance.' },
        { key: 'services.dataRecoveryDesc', zh: '专业数据找回，高成功率。', en: 'Professional data recovery with high success rate.' },
        { key: 'services.dataBackupDesc', zh: '安全迁移，完整备份保护。', en: 'Safe migration and complete backup protection.' },
        { key: 'serviceDetail.loading', zh: '加载中...', en: 'Loading...' },
        { key: 'serviceDetail.promoTag', zh: '限时优惠', en: 'Limited Offer' },
        { key: 'serviceDetail.highlights', zh: '服务亮点', en: 'Highlights' },
        { key: 'serviceDetail.flow', zh: '服务流程', en: 'Service Process' },
        { key: 'serviceDetail.stepOrder', zh: '在线下单', en: 'Place Order' },
        { key: 'serviceDetail.stepAccept', zh: '工程师接单', en: 'Engineer Accept' },
        { key: 'serviceDetail.stepVisit', zh: '上门服务', en: 'On-site Service' },
        { key: 'serviceDetail.stepConfirm', zh: '验收确认', en: 'Confirm' },
        { key: 'serviceDetail.stepReview', zh: '完成评价', en: 'Review' },
        { key: 'serviceDetail.consult', zh: '咨询', en: 'Consult' },
        { key: 'serviceDetail.bookNow', zh: '立即预约', en: 'Book Now' },
        { key: 'serviceDetail.highlight1', zh: '品质保障', en: 'Quality Assurance' },
        { key: 'serviceDetail.highlight1Desc', zh: '全部原装配件', en: 'All original parts' },
        { key: 'serviceDetail.highlight2', zh: '快速响应', en: 'Fast Response' },
        { key: 'serviceDetail.highlight2Desc', zh: '2小时内上门', en: 'On-site within 2 hours' },
        { key: 'serviceDetail.highlight3', zh: '透明报价', en: 'Transparent Pricing' },
        { key: 'serviceDetail.highlight3Desc', zh: '无隐形消费', en: 'No hidden charges' },
        { key: 'serviceDetail.highlight4', zh: '售后无忧', en: 'Worry-free' },
        { key: 'serviceDetail.highlight4Desc', zh: '90天质保', en: '90-day warranty' },
        { key: 'serviceDetail.loginTitle', zh: '未登录', en: 'Not Logged In' },
        { key: 'serviceDetail.loginMsg', zh: '请先登录后再预约服务', en: 'Please log in before booking a service' },
        { key: 'serviceBook.title', zh: '预约下单', en: 'Book Service' },
        { key: 'serviceBook.pickAddr', zh: '从已保存地址选取', en: 'Select from saved addresses' },
        { key: 'serviceBook.clearSelection', zh: '清除选择', en: 'Clear Selection' },
        { key: 'serviceBook.tagDefault', zh: '默认', en: 'Default' },
        { key: 'serviceBook.contact', zh: '联系人', en: 'Contact' },
        { key: 'serviceBook.contactPh', zh: '请输入联系人姓名', en: 'Enter contact name' },
        { key: 'serviceBook.phone', zh: '联系电话', en: 'Phone' },
        { key: 'serviceBook.phonePh', zh: '请输入联系电话', en: 'Enter phone number' },
        { key: 'serviceBook.productCategory', zh: '商品种类', en: 'Product Category' },
        { key: 'serviceBook.productCategoryPh', zh: '请选择商品种类', en: 'Select product category' },
        { key: 'serviceBook.productGuide', zh: '具体商品', en: 'Specific Product' },
        { key: 'serviceBook.productGuidePh', zh: '请选择具体商品', en: 'Select specific product' },
        { key: 'serviceBook.serial', zh: '商品序列号', en: 'Serial Number' },
        { key: 'serviceBook.serialPh', zh: '选填，可手动输入或点击下方我的商品', en: 'Optional, enter or select from My Products' },
        { key: 'serviceBook.fromMyProducts', zh: '从「我的商品」选择', en: 'Select from My Products' },
        { key: 'serviceBook.country', zh: '国家/地区', en: 'Country/Region' },
        { key: 'serviceBook.countryPh', zh: '请选择国家/地区', en: 'Select country/region' },
        { key: 'serviceBook.customCountry', zh: '自定义国家', en: 'Custom Country' },
        { key: 'serviceBook.customCountryPh', zh: '请输入国家/地区名称', en: 'Enter country/region name' },
        { key: 'serviceBook.area', zh: '省/市/区', en: 'Province/City/District' },
        { key: 'serviceBook.areaPh', zh: '请选择省市区', en: 'Select province/city/district' },
        { key: 'serviceBook.detail', zh: '详细地址', en: 'Detailed Address' },
        { key: 'serviceBook.detailPh', zh: '请输入小区/街道等具体地址', en: 'Enter street or building address' },
        { key: 'serviceBook.remark', zh: '备注', en: 'Remark' },
        { key: 'serviceBook.remarkPh', zh: '其他需要说明的事项（选填）', en: 'Other notes (optional)' },
        { key: 'serviceBook.total', zh: '合计：', en: 'Total: ' },
        { key: 'serviceBook.submit', zh: '确认预约', en: 'Confirm Booking' },
        { key: 'serviceBook.successTitle', zh: '预约成功', en: 'Booking Successful' },
        { key: 'serviceBook.successMsg', zh: '您的服务已预约成功，我们会尽快安排工程师。', en: 'Your service has been booked. An engineer will be arranged soon.' },
        { key: 'serviceBook.orderFailed', zh: '下单失败', en: 'Order failed' },
        { key: 'country.cn', zh: '中国大陆', en: 'Mainland China' },
        { key: 'country.hk', zh: '中国香港', en: 'Hong Kong' },
        { key: 'country.mo', zh: '中国澳门', en: 'Macau' },
        { key: 'country.tw', zh: '中国台湾', en: 'Taiwan' },
        { key: 'country.us', zh: '美国', en: 'United States' },
        { key: 'country.uk', zh: '英国', en: 'United Kingdom' },
        { key: 'country.jp', zh: '日本', en: 'Japan' },
        { key: 'country.kr', zh: '韩国', en: 'South Korea' },
        { key: 'country.sg', zh: '新加坡', en: 'Singapore' },
        { key: 'country.au', zh: '澳大利亚', en: 'Australia' },
        { key: 'country.ca', zh: '加拿大', en: 'Canada' },
        { key: 'country.de', zh: '德国', en: 'Germany' },
        { key: 'country.fr', zh: '法国', en: 'France' },
        { key: 'country.my', zh: '马来西亚', en: 'Malaysia' },
        { key: 'country.th', zh: '泰国', en: 'Thailand' },
        { key: 'country.other', zh: '其他', en: 'Other' },
        { key: 'login.title', zh: '登录', en: 'Login' },
        { key: 'login.welcome', zh: '欢迎使用 Vino 服务', en: 'Welcome to Vino Service' },
        { key: 'login.tabAccount', zh: '账号密码', en: 'Account' },
        { key: 'login.account', zh: '账号', en: 'Account' },
        { key: 'login.usernamePh', zh: '请输入用户名', en: 'Enter username' },
        { key: 'login.password', zh: '密码', en: 'Password' },
        { key: 'login.passwordPh', zh: '请输入密码', en: 'Enter password' },
        { key: 'login.tabPhone', zh: '手机验证码', en: 'Phone Code' },
        { key: 'login.phone', zh: '手机号', en: 'Phone' },
        { key: 'login.phonePh', zh: '请输入11位手机号', en: 'Enter 11-digit phone number' },
        { key: 'login.smsCode', zh: '验证码', en: 'Code' },
        { key: 'login.smsCodePh', zh: '请输入短信验证码', en: 'Enter SMS code' },
        { key: 'login.sendSms', zh: '获取验证码', en: 'Get Code' },
        { key: 'login.submit', zh: '登录', en: 'Login' },
        { key: 'login.noAccount', zh: '还没有账号？', en: "Don't have an account?" },
        { key: 'login.registerLink', zh: '立即注册', en: 'Register Now' },
        { key: 'login.loginOk', zh: '登录成功', en: 'Login successful' },
        { key: 'login.loginFailed', zh: '登录失败', en: 'Login failed' },
        { key: 'login.wxLogin', zh: '微信一键登录', en: 'WeChat Login' },
        { key: 'login.logging', zh: '登录中...', en: 'Logging in...' },
        { key: 'login.agreement', zh: '点击登录即表示同意《用户协议》和《隐私政策》', en: 'By logging in, you agree to the Terms and Privacy Policy' },
        { key: 'login.setupTitle', zh: '完善个人资料', en: 'Complete Profile' },
        { key: 'login.avatarPh', zh: '点击设置头像', en: 'Tap to set avatar' },
        { key: 'login.nicknamePh', zh: '请输入昵称', en: 'Enter nickname' },
        { key: 'login.saveEnter', zh: '保存并进入', en: 'Save & Enter' },
        { key: 'login.skip', zh: '跳过，直接进入', en: 'Skip' },
        { key: 'register.title', zh: '注册', en: 'Register' },
        { key: 'register.heading', zh: '创建账号', en: 'Create Account' },
        { key: 'register.tabEmail', zh: '邮箱注册', en: 'Email' },
        { key: 'register.tabPhone', zh: '手机号注册', en: 'Phone' },
        { key: 'register.username', zh: '账号', en: 'Account' },
        { key: 'register.usernamePh', zh: '请输入用户名（2-50字符）', en: 'Enter username (2-50 chars)' },
        { key: 'register.password', zh: '密码', en: 'Password' },
        { key: 'register.passwordPh', zh: '请输入密码（至少6位）', en: 'Enter password (min 6 chars)' },
        { key: 'register.email', zh: '邮箱', en: 'Email' },
        { key: 'register.emailPh', zh: '请输入邮箱', en: 'Enter email' },
        { key: 'register.code', zh: '验证码', en: 'Code' },
        { key: 'register.emailCodePh', zh: '请输入邮箱验证码', en: 'Enter email verification code' },
        { key: 'register.sendEmailCode', zh: '发送验证码', en: 'Send Code' },
        { key: 'register.nickname', zh: '昵称', en: 'Nickname' },
        { key: 'register.nicknamePh', zh: '选填', en: 'Optional' },
        { key: 'register.phonePh', zh: '请输入11位手机号', en: 'Enter 11-digit phone number' },
        { key: 'register.smsCodePh', zh: '请输入短信验证码', en: 'Enter SMS code' },
        { key: 'register.submit', zh: '注册', en: 'Register' },
        { key: 'register.hasAccount', zh: '已有账号？', en: 'Already have an account?' },
        { key: 'register.loginLink', zh: '去登录', en: 'Login' },
        { key: 'register.registerOk', zh: '注册成功', en: 'Registration successful' },
        { key: 'register.registerFailed', zh: '注册失败', en: 'Registration failed' },
        { key: 'mine.user', zh: '用户', en: 'User' },
        { key: 'mine.tapLogin', zh: '点击登录', en: 'Tap to Login' },
        { key: 'mine.loginBenefits', zh: '登录享更多权益', en: 'Login for more benefits' },
        { key: 'mine.orders', zh: '我的订单', en: 'My Orders' },
        { key: 'mine.products', zh: '我的商品', en: 'My Products' },
        { key: 'mine.address', zh: '地址管理', en: 'Addresses' },
        { key: 'mine.feedback', zh: '意见反馈', en: 'Feedback' },
        { key: 'mine.about', zh: '关于Vino', en: 'About Vino' },
        { key: 'mine.contact', zh: '联系我们', en: 'Contact Us' },
        { key: 'mine.logout', zh: '退出登录', en: 'Logout' },
        { key: 'mine.noPhone', zh: '未绑定手机', en: 'Phone not bound' },
        { key: 'mine.contactTitle', zh: '联系我们', en: 'Contact Us' },
        { key: 'mine.contactPhone', zh: '客服电话：', en: 'Service Phone: ' },
        { key: 'mine.pendingPay', zh: '待支付', en: 'Unpaid' },
        { key: 'mine.inProgress', zh: '进行中', en: 'In Progress' },
        { key: 'mine.pendingReview', zh: '待评价', en: 'To Review' },
        { key: 'mine.afterSales', zh: '售后', en: 'After-sales' },
        { key: 'mine.logoutConfirm', zh: '确定要退出登录吗？', en: 'Are you sure to log out?' },
        { key: 'mine.loggedOut', zh: '已退出', en: 'Logged out' },
        { key: 'mine.copied', zh: '已复制', en: 'Copied' },
        { key: 'mine.copyFailed', zh: '复制失败，请长按号码手动复制', en: 'Copy failed, please copy manually' },
        { key: 'mine.comingSoon', zh: '功能开发中', en: 'Coming soon' },
        { key: 'orders.all', zh: '全部', en: 'All' },
        { key: 'orders.pendingPay', zh: '待支付', en: 'Unpaid' },
        { key: 'orders.paid', zh: '已支付', en: 'Paid' },
        { key: 'orders.processing', zh: '进行中', en: 'In Progress' },
        { key: 'orders.completed', zh: '已完成', en: 'Completed' },
        { key: 'orders.cancelled', zh: '已取消', en: 'Cancelled' },
        { key: 'orders.empty', zh: '暂无订单', en: 'No orders yet' },
        { key: 'orders.noMore', zh: '没有更多了', en: 'No more' },
        { key: 'orders.cancel', zh: '取消订单', en: 'Cancel Order' },
        { key: 'orders.cancelConfirm', zh: '确定要取消该订单吗？', en: 'Are you sure to cancel this order?' },
        { key: 'orders.cancelled2', zh: '订单已取消', en: 'Order cancelled' },
        { key: 'orders.loginFirst', zh: '请先登录', en: 'Please log in first' },
        { key: 'orders.loginTip', zh: '请先登录查看订单', en: 'Please log in to view orders' },
        { key: 'orders.goLogin', zh: '去登录', en: 'Login' },
        { key: 'orders.pay', zh: '去支付', en: 'Pay' },
        { key: 'orders.payOk', zh: '支付成功', en: 'Payment successful' },
        { key: 'orders.payIncomplete', zh: '支付未完成', en: 'Payment incomplete' },
        { key: 'orders.payFailed', zh: '无法发起支付', en: 'Cannot start payment' },
        { key: 'orders.cancelFailed', zh: '取消失败', en: 'Cancel failed' },
        { key: 'myProducts.title', zh: '我的商品', en: 'My Products' },
        { key: 'myProducts.add', zh: '添加商品', en: 'Add Product' },
        { key: 'myProducts.empty', zh: '暂无绑定商品，点击右上角「添加商品」上传二维码', en: 'No bound products. Tap "Add Product" to scan QR.' },
        { key: 'myProducts.category', zh: '种类', en: 'Category' },
        { key: 'myProducts.name', zh: '名称', en: 'Name' },
        { key: 'myProducts.serial', zh: '序列号', en: 'Serial No.' },
        { key: 'myProducts.boundAt', zh: '绑定时间', en: 'Bound At' },
        { key: 'addressList.title', zh: '地址管理', en: 'Addresses' },
        { key: 'addressList.default', zh: '默认', en: 'Default' },
        { key: 'addressList.setDefault', zh: '设为默认', en: 'Set Default' },
        { key: 'addressList.defaultAddr', zh: '默认地址', en: 'Default Address' },
        { key: 'addressList.edit', zh: '编辑', en: 'Edit' },
        { key: 'addressList.delete', zh: '删除', en: 'Delete' },
        { key: 'addressList.empty', zh: '暂无收货地址', en: 'No addresses yet' },
        { key: 'addressList.add', zh: '新增地址', en: 'Add Address' },
        { key: 'addressList.deleteConfirm', zh: '确定删除该地址吗？', en: 'Delete this address?' },
        { key: 'addressList.deleted', zh: '已删除', en: 'Deleted' },
        { key: 'addressList.setDefaultOk', zh: '已设为默认', en: 'Set as default' },
        { key: 'addressEdit.titleEdit', zh: '编辑地址', en: 'Edit Address' },
        { key: 'addressEdit.titleNew', zh: '新增地址', en: 'New Address' },
        { key: 'addressEdit.contact', zh: '联系人', en: 'Contact' },
        { key: 'addressEdit.contactPh', zh: '请输入联系人姓名', en: 'Enter contact name' },
        { key: 'addressEdit.phone', zh: '联系电话', en: 'Phone' },
        { key: 'addressEdit.phonePh', zh: '请输入联系电话', en: 'Enter phone number' },
        { key: 'addressEdit.country', zh: '国家/地区', en: 'Country/Region' },
        { key: 'addressEdit.countryPh', zh: '请选择国家/地区', en: 'Select country/region' },
        { key: 'addressEdit.customCountry', zh: '自定义国家', en: 'Custom Country' },
        { key: 'addressEdit.customCountryPh', zh: '请输入国家/地区名称', en: 'Enter country/region name' },
        { key: 'addressEdit.area', zh: '省/市/区', en: 'Province/City/District' },
        { key: 'addressEdit.areaPh', zh: '请选择省市区', en: 'Select province/city/district' },
        { key: 'addressEdit.detail', zh: '详细地址', en: 'Detailed Address' },
        { key: 'addressEdit.detailPh', zh: '请输入小区/街道等具体地址', en: 'Enter street or building address' },
        { key: 'addressEdit.setDefault', zh: '设为默认地址', en: 'Set as default' },
        { key: 'addressEdit.save', zh: '保存', en: 'Save' },
        { key: 'addressEdit.saveOk', zh: '保存成功', en: 'Saved' },
        { key: 'addressEdit.saveFailed', zh: '保存失败', en: 'Save failed' },
        { key: 'guideDetail.title', zh: '设备指南', en: 'Device Guide' },
        { key: 'guideDetail.helpSection', zh: '使用帮助', en: 'Help' },
        { key: 'guideDetail.manual', zh: '电子说明书', en: 'Manual' },
        { key: 'guideDetail.maintenance', zh: '常见问题与保养建议', en: 'FAQ & Maintenance' },
        { key: 'guideDetail.serviceSection', zh: '服务入口', en: 'Service Entry' },
        { key: 'guideDetail.selfService', zh: '自助服务', en: 'Self Service' },
        { key: 'guideDetail.stores', zh: '服务网点', en: 'Service Centers' },
        { key: 'guideDetail.policy', zh: '售后政策', en: 'After-sales Policy' },
        { key: 'guideDetail.repairQuote', zh: '维修报价', en: 'Repair Quote' },
        { key: 'guideDetail.backHome', zh: '返回主页', en: 'Back to Home' },
        { key: 'bindProduct.title', zh: '绑定商品', en: 'Bind Product' },
        { key: 'bindProduct.processing', zh: '处理中...', en: 'Processing...' },
        { key: 'bindProduct.successTitle', zh: '绑定成功', en: 'Bound Successfully' },
        { key: 'bindProduct.serialLabel', zh: '序列号：', en: 'Serial: ' },
        { key: 'bindProduct.backHome', zh: '返回首页', en: 'Back to Home' },
        { key: 'bindProduct.errorTaken', zh: '已被其他账号绑定', en: 'Already bound to another account' },
        { key: 'bindProduct.errorFailed', zh: '绑定失败', en: 'Binding failed' },
        { key: 'profileEdit.title', zh: '个人资料', en: 'Profile' },
        { key: 'profileEdit.changeAvatar', zh: '更换头像', en: 'Change Avatar' },
        { key: 'profileEdit.chooseAvatar', zh: '选择头像', en: 'Choose Avatar' },
        { key: 'profileEdit.changeNickname', zh: '修改昵称', en: 'Edit Nickname' },
        { key: 'profileEdit.nicknamePh', zh: '点击修改', en: 'Tap to edit' },
        { key: 'profileEdit.phone', zh: '手机号', en: 'Phone' },
        { key: 'profileEdit.changePhone', zh: '更换', en: 'Change' },
        { key: 'profileEdit.phonePh', zh: '11位手机号', en: '11-digit phone' },
        { key: 'profileEdit.codePh', zh: '验证码', en: 'Code' },
        { key: 'profileEdit.sendSms', zh: '获取验证码', en: 'Get Code' },
        { key: 'profileEdit.bind', zh: '绑定', en: 'Bind' },
        { key: 'chat.title', zh: '在线客服', en: 'Customer Service' },
        { key: 'chat.emptyHint', zh: '暂无消息，发送第一条消息开始对话吧', en: 'No messages yet, send the first one' },
        { key: 'chat.adminAvatar', zh: '客', en: 'CS' },
        { key: 'chat.userAvatar', zh: '我', en: 'Me' },
        { key: 'chat.sendImageTitle', zh: '发送图片', en: 'Send Image' },
        { key: 'chat.inputPh', zh: '输入消息...', en: 'Type a message...' },
        { key: 'chat.loginHint', zh: '请先登录后发送消息', en: 'Please log in to send messages' },
        { key: 'chat.sendFailed', zh: '发送失败', en: 'Send failed' },
        { key: 'chat.uploadFailed', zh: '图片上传失败', en: 'Image upload failed' },
        { key: 'chat.send', zh: '发送', en: 'Send' },
        { key: 'common.loading', zh: '加载中...', en: 'Loading...' },
        { key: 'common.loadFailed', zh: '加载失败', en: 'Load failed' },
        { key: 'common.opFailed', zh: '操作失败', en: 'Operation failed' },
        { key: 'common.confirm', zh: '确认', en: 'Confirm' },
        { key: 'common.cancel', zh: '取消', en: 'Cancel' },
        { key: 'common.close', zh: '关闭', en: 'Close' },
        { key: 'common.copy', zh: '复制', en: 'Copy' },
        { key: 'common.save', zh: '保存', en: 'Save' },
        { key: 'common.delete', zh: '删除', en: 'Delete' },
        { key: 'common.edit', zh: '编辑', en: 'Edit' },
        { key: 'common.confirmDelete', zh: '确认删除', en: 'Confirm Delete' },
        { key: 'manual.title', zh: '电子说明书', en: 'Manual' },
        { key: 'manual.empty', zh: '暂无说明书内容', en: 'No manual content' },
        { key: 'manual.toc', zh: '目录', en: 'Table of Contents' },
        { key: 'manual.openWeb', zh: '打开说明书网页', en: 'Open Manual Page' },
        { key: 'manual.viewManual', zh: '查看说明书', en: 'View Manual' },
        { key: 'manual.disclaimer', zh: '以上内容仅供参考，请以实际产品为准', en: 'Content is for reference only' },
        { key: 'maintenance.title', zh: '维护指南', en: 'Maintenance Guide' },
        { key: 'maintenance.empty', zh: '暂无维护内容', en: 'No maintenance content' },
        { key: 'maintenance.toc', zh: '目录', en: 'Table of Contents' },
        { key: 'maintenance.disclaimer', zh: '以上内容仅供参考，请以实际情况为准', en: 'Content is for reference only' },
        { key: 'maintenance.faq', zh: '常见问题与保养建议', en: 'FAQ & Maintenance Tips' },
        { key: 'webview.aboutVino', zh: '关于Vino', en: 'About Vino' },
        { key: 'home.memberBenefits', zh: '会员权益', en: 'Member Benefits' },
        { key: 'home.exclusiveDiscount', zh: '专属折扣', en: 'Exclusive Discounts' },
        { key: 'home.serviceGuarantee', zh: '服务保障', en: 'Service Guarantee' },
        { key: 'home.worryfreeAfterSales', zh: '售后无忧', en: 'Worry-free After-sales' },
        { key: 'home.pointsMall', zh: '积分商城', en: 'Points Mall' },
        { key: 'home.giftExchange', zh: '礼品兑换', en: 'Gift Exchange' },
        { key: 'home.inviteReward', zh: '邀请有礼', en: 'Invite Rewards' },
        { key: 'home.shareCommission', zh: '分享赚佣金', en: 'Share & Earn' },
        { key: 'home.noProduct', zh: '暂无商品', en: 'No product' },
        { key: 'home.noLink', zh: '暂无链接', en: 'No link' },
        { key: 'mine.callNow', zh: '立即拨打', en: 'Call Now' },
        { key: 'mine.copy', zh: '复制', en: 'Copy' },
        { key: 'login.slogan', zh: '专业·高效·可信赖', en: 'Professional · Efficient · Reliable' },
        { key: 'login.wxLoginFailed', zh: '微信登录失败', en: 'WeChat login failed' },
        { key: 'login.codeError', zh: '验证码错误', en: 'Invalid code' },
        { key: 'login.setupSuccess', zh: '设置成功', en: 'Setup complete' },
        { key: 'login.avatarPlaceholder', zh: '点击设置头像', en: 'Tap to set avatar' },
        { key: 'login.nicknameLabel', zh: '昵称', en: 'Nickname' },
        { key: 'login.nicknamePlaceholder', zh: '请输入昵称', en: 'Enter nickname' },
        { key: 'login.saveAndEnter', zh: '保存并进入', en: 'Save & Enter' },
        { key: 'myProducts.notLoggedIn', zh: '未登录', en: 'Not Logged In' },
        { key: 'myProducts.loginFirst', zh: '请先登录后再添加商品', en: 'Please log in to add products' },
        { key: 'myProducts.goLogin', zh: '去登录', en: 'Login' },
        { key: 'myProducts.recognizing', zh: '识别中...', en: 'Recognizing...' },
        { key: 'myProducts.bindSuccess', zh: '绑定成功', en: 'Bound successfully' },
        { key: 'myProducts.bindFailed', zh: '绑定失败', en: 'Binding failed' },
        { key: 'myProducts.uploadFailed', zh: '上传失败', en: 'Upload failed' },
        { key: 'myProducts.addBtn', zh: '添加商品', en: 'Add Product' },
        { key: 'orders.loading', zh: '加载中...', en: 'Loading...' },
        { key: 'orders.cancelOrder', zh: '取消订单', en: 'Cancel Order' },
        { key: 'orders.cancelTitle', zh: '取消订单', en: 'Cancel Order' },
        { key: 'orders.orderCancelled', zh: '订单已取消', en: 'Order Cancelled' },
        { key: 'orders.loginRequired', zh: '请先登录', en: 'Please log in first' },
        { key: 'orders.paySuccess', zh: '支付成功', en: 'Payment successful' },
        { key: 'chat.loading', zh: '加载中...', en: 'Loading...' },
        { key: 'chat.inputPlaceholder', zh: '输入消息...', en: 'Type a message...' },
        { key: 'chat.loginRequired', zh: '请先登录', en: 'Please log in first' },
        { key: 'chat.sending', zh: '发送中...', en: 'Sending...' },
        { key: 'profileEdit.avatarUpdated', zh: '头像已更新', en: 'Avatar updated' },
        { key: 'profileEdit.uploadFailed', zh: '上传失败', en: 'Upload failed' },
        { key: 'profileEdit.uploading', zh: '上传中...', en: 'Uploading...' },
        { key: 'profileEdit.nicknameUpdated', zh: '昵称已更新', en: 'Nickname updated' },
        { key: 'profileEdit.updateFailed', zh: '更新失败', en: 'Update failed' },
        { key: 'profileEdit.errPhone', zh: '请输入正确的手机号', en: 'Invalid phone number' },
        { key: 'profileEdit.codeSent', zh: '验证码已发送', en: 'Code sent' },
        { key: 'profileEdit.sendFailed', zh: '发送失败', en: 'Send failed' },
        { key: 'profileEdit.errCode', zh: '请输入验证码', en: 'Please enter code' },
        { key: 'profileEdit.bindSuccess', zh: '绑定成功', en: 'Bound successfully' },
        { key: 'profileEdit.bindFailed', zh: '绑定失败', en: 'Binding failed' },
        { key: 'profileEdit.selectAvatar', zh: '选择头像', en: 'Choose Avatar' },
        { key: 'profileEdit.change', zh: '更换', en: 'Change' },
        { key: 'profileEdit.getCode', zh: '获取验证码', en: 'Get Code' },
        { key: 'guideDetail.noManual', zh: '暂无说明书', en: 'No manual available' },
        { key: 'guideDetail.helpTitle', zh: '使用帮助', en: 'Help' },
        { key: 'guideDetail.faq', zh: '常见问题与保养建议', en: 'FAQ & Maintenance' },
        { key: 'guideDetail.serviceEntry', zh: '服务入口', en: 'Service Entry' },
        { key: 'guideDetail.servicePoint', zh: '服务网点', en: 'Service Centers' },
        { key: 'guideDetail.afterSales', zh: '售后政策', en: 'After-sales Policy' },
        { key: 'manual.suffix', zh: '电子说明书', en: 'Manual' },
        { key: 'manual.openFailed', zh: '打开失败', en: 'Failed to open' },
        { key: 'manual.chapterCountPrefix', zh: '共', en: '' },
        { key: 'manual.chapterCountSuffix', zh: '章', en: ' chapters' },
        { key: 'maintenance.suffix', zh: '维护指南', en: 'Maintenance Guide' },
        { key: 'maintenance.sectionCountPrefix', zh: '共', en: '' },
        { key: 'maintenance.sectionCountSuffix', zh: '节', en: ' sections' },
        { key: 'serviceDetail.title', zh: '服务详情', en: 'Service Details' },
        { key: 'serviceDetail.total', zh: '合计：', en: 'Total: ' },
        { key: 'serviceDetail.modalTitle', zh: '预约服务', en: 'Book Service' },
        { key: 'serviceDetail.confirmBook', zh: '确认预约', en: 'Confirm Booking' },
        { key: 'serviceDetail.bookSuccess', zh: '预约成功', en: 'Booking Successful' },
        { key: 'serviceDetail.bookSuccessMsg', zh: '您的服务已预约成功，我们会尽快安排工程师。', en: 'Your service has been booked. An engineer will be arranged soon.' },
        { key: 'serviceDetail.bookFailed', zh: '预约失败', en: 'Booking failed' },
        { key: 'serviceDetail.consultPrefix', zh: '我想咨询一下', en: 'I would like to inquire about' },
        { key: 'serviceDetail.thisService', zh: '该服务', en: 'this service' },
        { key: 'serviceDetail.defaultDesc', zh: '专业服务，品质保障。', en: 'Professional service with quality assurance.' },
        { key: 'serviceBook.errContact', zh: '请填写联系人', en: 'Please enter contact name' },
        { key: 'serviceBook.errPhone', zh: '请填写联系电话', en: 'Please enter phone number' },
        { key: 'serviceBook.errCategory', zh: '请选择商品种类', en: 'Please select product category' },
        { key: 'serviceBook.errProduct', zh: '请选择具体商品', en: 'Please select a product' },
        { key: 'serviceBook.errCountry', zh: '请选择国家/地区', en: 'Please select country/region' },
        { key: 'serviceBook.errCustomCountry', zh: '请填写自定义国家/地区', en: 'Please enter custom country' },
        { key: 'serviceBook.errRegion', zh: '请选择省市区', en: 'Please select region' },
        { key: 'serviceBook.errAddress', zh: '请填写详细地址', en: 'Please enter address' },
        { key: 'serviceBook.loginTitle', zh: '未登录', en: 'Not Logged In' },
        { key: 'serviceBook.loginMsg', zh: '请先登录后再预约服务', en: 'Please log in before booking' },
        { key: 'addressEdit.errContact', zh: '请填写联系人', en: 'Please enter contact name' },
        { key: 'addressEdit.errPhone', zh: '请填写联系电话', en: 'Please enter phone number' },
        { key: 'addressEdit.errAddress', zh: '请填写详细地址', en: 'Please enter address' },
        { key: 'addressEdit.phSelect', zh: '请选择', en: 'Please select' },
        { key: 'addressList.confirmDeleteTitle', zh: '删除地址', en: 'Delete Address' },
        { key: 'addressList.confirmDeleteContent', zh: '确定删除该地址吗？', en: 'Delete this address?' },
        { key: 'addressList.deleteFailed', zh: '删除失败', en: 'Delete failed' },
        { key: 'common.operationFailed', zh: '操作失败', en: 'Operation failed' },
      ];
      await I18nText.bulkCreate(seed);
      console.log('[DB] Default i18n texts created.');
    } else {
      const seed = [
        { key: 'webview.aboutVino', zh: '关于Vino', en: 'About Vino' },
        { key: 'home.memberBenefits', zh: '会员权益', en: 'Member Benefits' },
        { key: 'home.exclusiveDiscount', zh: '专属折扣', en: 'Exclusive Discounts' },
        { key: 'home.serviceGuarantee', zh: '服务保障', en: 'Service Guarantee' },
        { key: 'home.worryfreeAfterSales', zh: '售后无忧', en: 'Worry-free After-sales' },
        { key: 'home.pointsMall', zh: '积分商城', en: 'Points Mall' },
        { key: 'home.giftExchange', zh: '礼品兑换', en: 'Gift Exchange' },
        { key: 'home.inviteReward', zh: '邀请有礼', en: 'Invite Rewards' },
        { key: 'home.shareCommission', zh: '分享赚佣金', en: 'Share & Earn' },
        { key: 'home.noProduct', zh: '暂无商品', en: 'No product' },
        { key: 'home.noLink', zh: '暂无链接', en: 'No link' },
        { key: 'mine.callNow', zh: '立即拨打', en: 'Call Now' },
        { key: 'mine.copy', zh: '复制', en: 'Copy' },
        { key: 'login.slogan', zh: '专业·高效·可信赖', en: 'Professional · Efficient · Reliable' },
        { key: 'login.wxLoginFailed', zh: '微信登录失败', en: 'WeChat login failed' },
        { key: 'login.codeError', zh: '验证码错误', en: 'Invalid code' },
        { key: 'login.setupSuccess', zh: '设置成功', en: 'Setup complete' },
        { key: 'login.avatarPlaceholder', zh: '点击设置头像', en: 'Tap to set avatar' },
        { key: 'login.nicknameLabel', zh: '昵称', en: 'Nickname' },
        { key: 'login.nicknamePlaceholder', zh: '请输入昵称', en: 'Enter nickname' },
        { key: 'login.saveAndEnter', zh: '保存并进入', en: 'Save & Enter' },
        { key: 'myProducts.notLoggedIn', zh: '未登录', en: 'Not Logged In' },
        { key: 'myProducts.loginFirst', zh: '请先登录后再添加商品', en: 'Please log in to add products' },
        { key: 'myProducts.goLogin', zh: '去登录', en: 'Login' },
        { key: 'myProducts.recognizing', zh: '识别中...', en: 'Recognizing...' },
        { key: 'myProducts.bindSuccess', zh: '绑定成功', en: 'Bound successfully' },
        { key: 'myProducts.bindFailed', zh: '绑定失败', en: 'Binding failed' },
        { key: 'myProducts.uploadFailed', zh: '上传失败', en: 'Upload failed' },
        { key: 'myProducts.addBtn', zh: '添加商品', en: 'Add Product' },
        { key: 'orders.loading', zh: '加载中...', en: 'Loading...' },
        { key: 'orders.cancelOrder', zh: '取消订单', en: 'Cancel Order' },
        { key: 'orders.cancelTitle', zh: '取消订单', en: 'Cancel Order' },
        { key: 'orders.orderCancelled', zh: '订单已取消', en: 'Order Cancelled' },
        { key: 'orders.loginRequired', zh: '请先登录', en: 'Please log in first' },
        { key: 'orders.paySuccess', zh: '支付成功', en: 'Payment successful' },
        { key: 'chat.loading', zh: '加载中...', en: 'Loading...' },
        { key: 'chat.inputPlaceholder', zh: '输入消息...', en: 'Type a message...' },
        { key: 'chat.loginRequired', zh: '请先登录', en: 'Please log in first' },
        { key: 'chat.sending', zh: '发送中...', en: 'Sending...' },
        { key: 'profileEdit.avatarUpdated', zh: '头像已更新', en: 'Avatar updated' },
        { key: 'profileEdit.uploadFailed', zh: '上传失败', en: 'Upload failed' },
        { key: 'profileEdit.uploading', zh: '上传中...', en: 'Uploading...' },
        { key: 'profileEdit.nicknameUpdated', zh: '昵称已更新', en: 'Nickname updated' },
        { key: 'profileEdit.updateFailed', zh: '更新失败', en: 'Update failed' },
        { key: 'profileEdit.errPhone', zh: '请输入正确的手机号', en: 'Invalid phone number' },
        { key: 'profileEdit.codeSent', zh: '验证码已发送', en: 'Code sent' },
        { key: 'profileEdit.sendFailed', zh: '发送失败', en: 'Send failed' },
        { key: 'profileEdit.errCode', zh: '请输入验证码', en: 'Please enter code' },
        { key: 'profileEdit.bindSuccess', zh: '绑定成功', en: 'Bound successfully' },
        { key: 'profileEdit.bindFailed', zh: '绑定失败', en: 'Binding failed' },
        { key: 'profileEdit.selectAvatar', zh: '选择头像', en: 'Choose Avatar' },
        { key: 'profileEdit.change', zh: '更换', en: 'Change' },
        { key: 'profileEdit.getCode', zh: '获取验证码', en: 'Get Code' },
        { key: 'guideDetail.noManual', zh: '暂无说明书', en: 'No manual available' },
        { key: 'guideDetail.helpTitle', zh: '使用帮助', en: 'Help' },
        { key: 'guideDetail.faq', zh: '常见问题与保养建议', en: 'FAQ & Maintenance' },
        { key: 'guideDetail.serviceEntry', zh: '服务入口', en: 'Service Entry' },
        { key: 'guideDetail.servicePoint', zh: '服务网点', en: 'Service Centers' },
        { key: 'guideDetail.afterSales', zh: '售后政策', en: 'After-sales Policy' },
        { key: 'manual.suffix', zh: '电子说明书', en: 'Manual' },
        { key: 'manual.openFailed', zh: '打开失败', en: 'Failed to open' },
        { key: 'manual.chapterCountPrefix', zh: '共', en: '' },
        { key: 'manual.chapterCountSuffix', zh: '章', en: ' chapters' },
        { key: 'maintenance.suffix', zh: '维护指南', en: 'Maintenance Guide' },
        { key: 'maintenance.sectionCountPrefix', zh: '共', en: '' },
        { key: 'maintenance.sectionCountSuffix', zh: '节', en: ' sections' },
        { key: 'serviceDetail.title', zh: '服务详情', en: 'Service Details' },
        { key: 'serviceDetail.total', zh: '合计：', en: 'Total: ' },
        { key: 'serviceDetail.modalTitle', zh: '预约服务', en: 'Book Service' },
        { key: 'serviceDetail.confirmBook', zh: '确认预约', en: 'Confirm Booking' },
        { key: 'serviceDetail.bookSuccess', zh: '预约成功', en: 'Booking Successful' },
        { key: 'serviceDetail.bookSuccessMsg', zh: '您的服务已预约成功，我们会尽快安排工程师。', en: 'Your service has been booked.' },
        { key: 'serviceDetail.bookFailed', zh: '预约失败', en: 'Booking failed' },
        { key: 'serviceDetail.consultPrefix', zh: '我想咨询一下', en: 'I would like to inquire about' },
        { key: 'serviceDetail.thisService', zh: '该服务', en: 'this service' },
        { key: 'serviceDetail.defaultDesc', zh: '专业服务，品质保障。', en: 'Professional service with quality assurance.' },
        { key: 'serviceBook.errContact', zh: '请填写联系人', en: 'Please enter contact name' },
        { key: 'serviceBook.errPhone', zh: '请填写联系电话', en: 'Please enter phone number' },
        { key: 'serviceBook.errCategory', zh: '请选择商品种类', en: 'Please select product category' },
        { key: 'serviceBook.errProduct', zh: '请选择具体商品', en: 'Please select a product' },
        { key: 'serviceBook.errCountry', zh: '请选择国家/地区', en: 'Please select country/region' },
        { key: 'serviceBook.errCustomCountry', zh: '请填写自定义国家/地区', en: 'Please enter custom country' },
        { key: 'serviceBook.errRegion', zh: '请选择省市区', en: 'Please select region' },
        { key: 'serviceBook.errAddress', zh: '请填写详细地址', en: 'Please enter address' },
        { key: 'serviceBook.loginTitle', zh: '未登录', en: 'Not Logged In' },
        { key: 'serviceBook.loginMsg', zh: '请先登录后再预约服务', en: 'Please log in before booking' },
        { key: 'addressEdit.errContact', zh: '请填写联系人', en: 'Please enter contact name' },
        { key: 'addressEdit.errPhone', zh: '请填写联系电话', en: 'Please enter phone number' },
        { key: 'addressEdit.errAddress', zh: '请填写详细地址', en: 'Please enter address' },
        { key: 'addressEdit.phSelect', zh: '请选择', en: 'Please select' },
        { key: 'addressList.confirmDeleteTitle', zh: '删除地址', en: 'Delete Address' },
        { key: 'addressList.confirmDeleteContent', zh: '确定删除该地址吗？', en: 'Delete this address?' },
        { key: 'addressList.deleteFailed', zh: '删除失败', en: 'Delete failed' },
        { key: 'common.operationFailed', zh: '操作失败', en: 'Operation failed' },
      ];
      for (const s of seed) {
        await I18nText.findOrCreate({ where: { key: s.key }, defaults: s });
      }
    }

    return true;
  } catch (error) {
    console.error('[DB] Unable to connect:', error.message);
    return false;
  }
};

module.exports = { ...models, sequelize, syncDatabase };
