const sequelize = require('../config/database');
const User = require('./User');
const Service = require('./Service');
const Order = require('./Order');
const OrderLog = require('./OrderLog');
const Address = require('./Address');

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Order.hasMany(OrderLog, { foreignKey: 'orderId', as: 'logs' });
OrderLog.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const models = { User, Service, Order, OrderLog, Address };

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

    return true;
  } catch (error) {
    console.error('[DB] Unable to connect:', error.message);
    return false;
  }
};

module.exports = { ...models, sequelize, syncDatabase };
