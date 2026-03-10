const sequelize = require('../config/database');
const User = require('./User');
const Service = require('./Service');
const Order = require('./Order');

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const models = { User, Service, Order };

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connection established successfully.');
    await sequelize.sync({ alter: true });
    console.log('[DB] All models synchronized.');
    return true;
  } catch (error) {
    console.error('[DB] Unable to connect:', error.message);
    return false;
  }
};

module.exports = { ...models, sequelize, syncDatabase };
