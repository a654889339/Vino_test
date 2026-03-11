const sequelize = require('../config/database');
const User = require('./User');
const Service = require('./Service');
const Order = require('./Order');
const OrderLog = require('./OrderLog');
const Address = require('./Address');
const DeviceGuide = require('./DeviceGuide');

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Order.hasMany(OrderLog, { foreignKey: 'orderId', as: 'logs' });
OrderLog.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const models = { User, Service, Order, OrderLog, Address, DeviceGuide };

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

    const guideCount = await DeviceGuide.count();
    if (guideCount === 0) {
      await DeviceGuide.bulkCreate([
        { name: '空调', subtitle: '家用/商用中央空调', icon: 'cluster-o', emoji: '❄️', gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', badge: '热门', sortOrder: 1, tags: JSON.stringify(['制冷维修','清洗保养','加氟充注','安装移机']), sections: JSON.stringify([{title:'常见故障',icon:'warning-o',tips:['不制冷/制热','漏水滴水','噪音异常','遥控器失灵','频繁启停']},{title:'保养建议',icon:'info-o',tips:['每月清洗滤网','每年专业深度清洗','定期检查制冷剂','室外机保持通风']}]) },
        { name: '除湿机', subtitle: '家用/工业除湿设备', icon: 'filter-o', emoji: '💧', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)', badge: '', sortOrder: 2, tags: JSON.stringify(['除湿维修','滤网更换','水箱清洁']), sections: JSON.stringify([{title:'常见故障',icon:'warning-o',tips:['不除湿','噪音过大','漏水','显示屏异常']},{title:'保养建议',icon:'info-o',tips:['定期清洗滤网','及时排空水箱','保持进出风口通畅']}]) },
        { name: '光储一体机', subtitle: '户用光储一体解决方案', icon: 'fire-o', emoji: '☀️', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', badge: '新', sortOrder: 3, tags: JSON.stringify(['系统检测','电池维护','并网调试']), sections: JSON.stringify([{title:'系统组成',icon:'info-o',tips:['光伏组件','储能电池','混合逆变器','智能监控']},{title:'维护要点',icon:'warning-o',tips:['定期检查光伏板清洁度','监控电池健康状态','检查线缆连接','软件系统更新']}]) },
        { name: '光伏变电器', subtitle: '光伏发电变电设备', icon: 'balance-list-o', emoji: '⚡', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', badge: '', sortOrder: 4, tags: JSON.stringify(['变压器检测','绝缘测试','效率优化']), sections: JSON.stringify([{title:'检测项目',icon:'warning-o',tips:['绝缘电阻测试','变比测试','温升检测','噪声检测']},{title:'维护建议',icon:'info-o',tips:['定期清洁散热装置','检查接线端子','监控运行温度','定期绝缘测试']}]) },
        { name: '逆变器', subtitle: '光伏/储能逆变器', icon: 'replay', emoji: '🔌', gradient: 'linear-gradient(135deg, #10B981, #059669)', badge: '', sortOrder: 5, tags: JSON.stringify(['故障诊断','固件升级','效率优化']), sections: JSON.stringify([{title:'常见故障',icon:'warning-o',tips:['不并网','功率不足','报错代码','通讯故障']},{title:'维护建议',icon:'info-o',tips:['保持通风散热','定期清洁滤网','检查直流端子','监控发电效率']}]) },
      ]);
      console.log('[DB] Default device guides created.');
    }

    return true;
  } catch (error) {
    console.error('[DB] Unable to connect:', error.message);
    return false;
  }
};

module.exports = { ...models, sequelize, syncDatabase };
