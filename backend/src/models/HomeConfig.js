const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HomeConfig = sequelize.define('HomeConfig', {
  section: {
    type: DataTypes.ENUM('banner', 'nav', 'hotService', 'recommend'),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  desc: {
    type: DataTypes.STRING(200),
    defaultValue: '',
  },
  icon: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  color: {
    type: DataTypes.STRING(200),
    defaultValue: '',
  },
  path: {
    type: DataTypes.STRING(200),
    defaultValue: '/services',
  },
  price: {
    type: DataTypes.STRING(20),
    defaultValue: '',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
}, {
  tableName: 'home_configs',
  timestamps: true,
});

module.exports = HomeConfig;
