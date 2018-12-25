const pkg = require('../../config/jest.config.settings');

module.exports = {
  ...pkg,
  setupFiles: ['<rootDir>/scripts/tests.js'],
};
