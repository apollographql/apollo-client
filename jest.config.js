module.exports = {
  rootDir: '.',
  // rootDir must be included as a project otherwise it finds no tests in packages below rootDir.
  // http://jestjs.io/docs/en/configuration.html#projects-array-string-projectconfig
  projects: ['<rootDir>', '<rootDir>/packages/*'],
  // globals: {
  //   'ts-jest': {
  //     tsConfig: '<rootDir>/tsconfig.json',
  //   },
  // },
  // transform: {
  //   '^.+\\.(j|t)sx?$': 'ts-jest',
  //   '^(?!.*\\.json$)': '<rootDir>/config/jsonTransform.ts',
  // },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  moduleNameMapper: {
    '(apollo-boost|apollo-cache|apollo-cache-inmemory|apollo-client|apollo-utilities|graphql-anywhere)(.*)':
      '<rootDir>/packages/$1/src/$2',
  },
};
