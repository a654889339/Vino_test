const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
sequelize.authenticate()
  .then(() => sequelize.query('DELETE FROM home_configs WHERE id = 33', { type: QueryTypes.DELETE }))
  .then(() => console.log('Deleted tabbar order entry (id=33)'))
  .catch(e => console.error(e))
  .finally(() => sequelize.close());
