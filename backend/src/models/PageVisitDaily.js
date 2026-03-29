const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PageVisitDaily = sequelize.define(
  'PageVisitDaily',
  {
    pageKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'page_key',
    },
    visitDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'visit_date',
    },
    count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'page_visit_daily',
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ['page_key', 'visit_date'] }],
  }
);

module.exports = PageVisitDaily;
