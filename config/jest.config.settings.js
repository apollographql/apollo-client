module.exports = {
  transform: {
    '.(ts|tsx)': 'ts-jest',
  },

  // globals: {
  //   'ts-jest': {
  //     tsConfig: {
  //       allowJs: true,
  //     },
  //   },
  // },

  // testMatch: ['**/__tests__/**/*.ts?(x)'],
  // testRegex: '(/__tests__/.*|\\.(test|spec))\\.(ts|tsx)$',
  // testPathIgnorePatterns: [
  //   '/node_modules/',
  //   '/lib/',
  //   '<rootDir>/lib/',
  //   '<rootDir>/../*/lib/',
  //   '<rootDir>/../.*/lib/',
  //   '<rootDir>/packages/*/lib/',
  //   '<rootDir>/packages/.*/lib/',
  // ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testURL: 'http://localhost',

  // start with defaults and spec all
  // testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],
  // testPathIgnorePatterns: ['/node_modules/'],
  // testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.jsx?$',
  testMatch: ['<rootDir>/src/**/__tests__/*.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '<rootDir>/lib/',
    // '<rootDir>/../*/lib/',
  ],
  // testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.jsx?$',
};
