module.exports = {
  ...require('../../config/jest.config.settings'),
  // must be inside the src dir
  setupFiles: ['<rootDir>/src/config/jest/setup.ts'],
};
