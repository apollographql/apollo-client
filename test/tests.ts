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

declare function require(name: string): any;
require('source-map-support').install();

console.warn = console.error = (...messages: string[]) => {
  console.log(`==> Error in test: Tried to log warning or error with message:
`, ...messages);
  if ( (!process.env.CI) && (!process.env.COV) ) {
    process.exit(1);
  }
};

process.on('unhandledRejection', () => {});

import './warnOnce';
import './fragmentMatcher';
import './writeToStore';
import './readFromStore';
import './roundtrip';
import './diffAgainstStore';
import './networkInterface';
import './deduplicator';
import './QueryManager';
import './client';
import './store';
import './queryTransform';
import './getFromAST';
import './directives';
import './batching';
import './scheduler';
import './mutationResults';
import './optimistic';
import './fetchMore';
import './errors';
import './mockNetworkInterface';
import './graphqlSubscriptions';
import './batchedNetworkInterface';
import './ObservableQuery';
import './subscribeToMore';
import './customResolvers';
import './isEqual';
import './cloneDeep';
import './assign';
import './environment';
import './ApolloClient';
import './proxy';
