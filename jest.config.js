module.exports = {
  rootDir: '.',
  projects: ['<rootDir>/packages/*'],

  moduleNameMapper: {
    '(apollo-boost|apollo-cache|apollo-cache-inmemory|apollo-client|apollo-utilities|graphql-anywhere)(.*)':
      '<rootDir>/packages/$1/src/$2',
  },
};
