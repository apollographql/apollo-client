module.exports = {
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

  testMatch: ['<rootDir>/src/**/__tests__/*.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '<rootDir>/lib/',
    // '<rootDir>/../*/lib/',
  ],

  // moduleNameMapper: {
  //   '(apollo-boost|apollo-cache-inmemory|apollo-cache|apollo-client|apollo-utilities|graphql-anywhere)(.*)':
  //     '<rootDir>/../$1/src/$2',
  // },
};
