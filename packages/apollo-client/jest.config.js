const pkg = require('../jest.config.settings');

module.exports = {
  ...pkg,
  setupFiles: ['<rootDir>/scripts/tests.js'],
};
