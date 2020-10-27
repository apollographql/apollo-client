const { compilerOptions } = require("../tsconfig.json");

module.exports = {
  rootDir: '..',
  transform: {
    '.(ts|tsx)': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      diagnostics: true,
      tsconfig: {
        ...compilerOptions,
        allowJs: true,
      },
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testURL: 'http://localhost',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  modulePathIgnorePatterns: ['/dist/'],
  setupFiles: ['<rootDir>/src/config/jest/setup.ts'],
};
