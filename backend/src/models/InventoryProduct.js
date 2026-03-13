const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryProduct = sequelize.define('InventoryProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  serialNumber: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '商品序列号，作为 key，扫码绑定时的参数',
  },
  guideSlug: {
    type: DataTypes.STRING(200),
    allowNull: true,
    defaultValue: '',
    comment: '商品配置，用于二维码链接参数及绑定后跳转 /guide/{guideSlug}',
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
  tableName: 'inventory_products',
  timestamps: true,
});

module.exports = InventoryProduct;
