const React = require('react');

// IMPORTANT NOTE:
//
// This file is intentionally using CommonJS. It's very important to
// create a React context for use with Apollo Client's React integration in
// one place only. Otherwise we can end up with a situation like:
//
// 1. `MockedProvider` in the `testing` bundle creates its own context.
// 2. An `ApolloClient` instance is stored in that context.
// 3. If the application under test is being bundled by something like webpack,
//    it can create its own separate context (since it's following the ESM
//    source).
// 4. This leads to the Apollo Client instance not being found in the
//    separate application context.
//
// By using CJS to refer to this file across the entire codebase,
// we ensure that we're only ever pointing to one copy of the source. We're
// not pointing to a copy that has been converted to CJS when bundling
// `apollo-client.cjs.js` or the `testing` bundle.

let apolloContext: any;

exports.getApolloContext = function getApolloContext() {
  if (!apolloContext) {
    apolloContext = React.createContext({});
  }
  return apolloContext;
}

exports.resetApolloContext = function resetApolloContext() {
  apolloContext = React.createContext({});
}
