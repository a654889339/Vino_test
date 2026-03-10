require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '5202'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'vino_default_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3308'),
    name: process.env.DB_NAME || 'vino_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'vino_secret_2024',
  },
};
