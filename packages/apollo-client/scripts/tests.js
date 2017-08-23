console.warn = console.error = (...messages) => {
  console.log(
    `==> Error in test: Tried to log warning or error with message:
`,
    ...messages,
  );
  if (!process.env.CI && !process.env.COV) {
    process.exit(1);
  }
};

process.on('unhandledRejection', () => {});

const { disableFragmentWarnings } = require('graphql-tag');

// Turn off warnings for repeated fragment names
disableFragmentWarnings();
