const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

const generateToken = (user) =>
  jwt.sign({ id: user.id, username: user.username, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

exports.register = async (req, res) => {
  try {
    const { username, password, nickname } = req.body;
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }
    if (String(username).trim().length < 2 || String(username).trim().length > 50) {
      return res.status(400).json({ code: 400, message: '用户名长度需在2-50个字符之间' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ code: 400, message: '密码长度不能少于6位' });
    }
    const existing = await User.findOne({ where: { username: String(username).trim() } });
    if (existing) {
      return res.status(400).json({ code: 400, message: '用户名已存在' });
    }
    const user = await User.create({
      username: String(username).trim(),
      password,
      nickname: nickname ? String(nickname).trim() : String(username).trim(),
    });
    const token = generateToken(user);
    res.json({ code: 0, data: { token, user } });
  } catch (err) {
    console.error('[Auth] register error:', err.message);
    res.status(500).json({ code: 500, message: '注册失败，请稍后重试' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }
    const user = await User.findOne({ where: { username: String(username).trim() } });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ code: 403, message: '账号已被禁用' });
    }
    const token = generateToken(user);
    res.json({ code: 0, data: { token, user } });
  } catch (err) {
    console.error('[Auth] login error:', err.message);
    res.status(500).json({ code: 500, message: '登录失败，请稍后重试' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    if (user.status !== 'active') {
      return res.status(403).json({ code: 403, message: '账号已被禁用' });
    }
    res.json({ code: 0, data: user });
  } catch (err) {
    console.error('[Auth] getProfile error:', err.message);
    res.status(500).json({ code: 500, message: '获取用户信息失败' });
  }
};
