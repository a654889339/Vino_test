const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const I18nText = sequelize.define('I18nText', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Unique identifier for this text entry',
  },
  zh: {
    type: DataTypes.STRING(500),
    allowNull: false,
    defaultValue: '',
    comment: 'Chinese text',
  },
  en: {
    type: DataTypes.STRING(500),
    allowNull: false,
    defaultValue: '',
    comment: 'English text',
  },
}, {
  tableName: 'i18n_texts',
  timestamps: true,
});

module.exports = I18nText;
