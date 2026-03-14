const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  icon: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  cover: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '兼容旧数据，新数据用 categoryId',
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属服务种类 ID',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  originPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '原价，详情页展示',
  },
  bg: {
    type: DataTypes.STRING(50),
    defaultValue: '#B91C1C',
    comment: '卡片/详情头部背景色',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'services',
  timestamps: true,
});

module.exports = Service;
