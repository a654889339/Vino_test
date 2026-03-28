const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductCategory = sequelize.define('ProductCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  /** 产品页：搜索框下方展示的分类横幅图（COS 路径或 URL） */
  thumbnailUrl: {
    type: DataTypes.STRING(1024),
    allowNull: true,
    field: 'thumbnail_url',
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
  tableName: 'product_categories',
  timestamps: true,
});

module.exports = ProductCategory;
