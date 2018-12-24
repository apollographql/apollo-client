const pkg = require('../../config/jest.config.settings');

module.exports = {
  ...pkg,
  // must be inside the src dir
  setupFiles: ['<rootDir>/src/config/jest/setup.ts'],
};
