const { compilerOptions } = require("../tsconfig.json");

module.exports = {
  rootDir: '../src',
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
  setupFiles: ['<rootDir>/config/jest/setup.ts'],
};
