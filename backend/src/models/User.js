const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  nickname: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  avatar: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  phone: {
    type: DataTypes.STRING(20),
    defaultValue: '',
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user',
  },
  status: {
    type: DataTypes.ENUM('active', 'disabled'),
    defaultValue: 'active',
  },
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (!user.password || String(user.password).trim().length === 0) {
        throw new Error('密码不能为空');
      }
      user.password = await bcrypt.hash(user.password, 10);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        if (!user.password || String(user.password).trim().length === 0) {
          throw new Error('密码不能为空');
        }
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
  },
});

User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;
