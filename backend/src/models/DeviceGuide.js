const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeviceGuide = sequelize.define('DeviceGuide', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  subtitle: {
    type: DataTypes.STRING(200),
    defaultValue: '',
  },
  icon: {
    type: DataTypes.STRING(100),
    defaultValue: 'setting-o',
  },
  emoji: {
    type: DataTypes.STRING(20),
    defaultValue: '',
  },
  gradient: {
    type: DataTypes.STRING(300),
    defaultValue: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
  },
  badge: {
    type: DataTypes.STRING(20),
    defaultValue: '',
  },
  tags: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('tags');
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    },
    set(val) {
      this.setDataValue('tags', JSON.stringify(val || []));
    },
  },
  sections: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    get() {
      const raw = this.getDataValue('sections');
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    },
    set(val) {
      this.setDataValue('sections', JSON.stringify(val || []));
    },
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
  tableName: 'device_guides',
  timestamps: true,
});

module.exports = DeviceGuide;
