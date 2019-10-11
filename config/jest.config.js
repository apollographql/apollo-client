module.exports = {
  rootDir: '..',
  transform: {
    '.(ts|tsx)': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testURL: 'http://localhost',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'src/__tests__/utils'
  ],
  modulePathIgnorePatterns: ['/dist/'],
  setupFiles: ['<rootDir>/src/config/jest/setup.ts'],
};
