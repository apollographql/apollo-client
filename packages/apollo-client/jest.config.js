const pkg = require('../../config/jest.config.settings');

module.exports = {
  ...pkg,
  setupFiles: ['<rootDir>/src/config/jest/setup.ts'], // must be inside the src dir
};
