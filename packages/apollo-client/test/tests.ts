/* tslint:disable */

// These should (and generally do) get picked up automatically as they're installed
// at @types/es6-shim, but it doesn't work in typedoc (or Atom it seems),
// so we include them here manually
/// <reference types="node" />
/// <reference types="mocha" />

// ensure support for fetch and promise
import 'es6-promise';
import 'isomorphic-fetch';

process.env.NODE_ENV = 'test';

declare function require(name: string): any
require('source-map-support').install();

console.warn = console.error = (...messages: string[]) => {
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

import { disableFragmentWarnings as graphqlTagDisableFragmentWarnings } from 'graphql-tag';

// Turn off warnings for repeated fragment names
graphqlTagDisableFragmentWarnings();

// import './ApolloClient';
import './assign';
// import './client';
import './cloneDeep';
import './directives';
import './environment';
import './errors';
// import './fetchMore';
import './fragmentMatcher';
import './getFromAST';
// import './graphqlSubscriptions';
import './isEqual';
// import './mutationResults';
// import './ObservableQuery';
// import './optimistic';
// import './QueryManager';
import './queryTransform';
// import './scheduler';
// import './subscribeToMore';
import './warnOnce';
