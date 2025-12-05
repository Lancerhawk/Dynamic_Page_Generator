const app = require('../backend/dist/server');

module.exports = (req, res) => {
  return app(req, res);
};
