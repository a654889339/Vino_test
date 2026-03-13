const sequelize = require('../config/database');
const User = require('./User');
const Service = require('./Service');
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

ProductCategory.hasMany(DeviceGuide, { foreignKey: 'categoryId', as: 'guides' });
DeviceGuide.belongsTo(ProductCategory, { foreignKey: 'categoryId', as: 'category' });

InventoryCategory.hasMany(InventoryProduct, { foreignKey: 'categoryId', as: 'products' });
InventoryProduct.belongsTo(InventoryCategory, { foreignKey: 'categoryId', as: 'category' });

User.hasMany(UserProduct, { foreignKey: 'userId', as: 'boundProducts' });
UserProduct.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Order.hasMany(OrderLog, { foreignKey: 'orderId', as: 'logs' });
OrderLog.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Message, { foreignKey: 'userId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const models = { User, Service, Order, OrderLog, Address, DeviceGuide, ProductCategory, HomeConfig, Message, InventoryCategory, InventoryProduct, UserProduct };

const ADMIN_PASSWORD = 'Vino@2024admin';

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connection established successfully.');
    await sequelize.sync({ alter: true });
    console.log('[DB] All models synchronized.');

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

    return true;
  } catch (error) {
    console.error('[DB] Unable to connect:', error.message);
    return false;
  }
};

module.exports = { ...models, sequelize, syncDatabase };
