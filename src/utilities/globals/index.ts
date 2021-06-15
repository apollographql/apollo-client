// Just in case the graphql package switches from process.env.NODE_ENV to
// __DEV__, make sure __DEV__ is polyfilled before importing graphql.
import { default as __DEV__ } from "./__DEV__";
export { __DEV__ }

// Import graphql/jsutils/instanceOf safely, working around its unchecked usage
// of process.env.NODE_ENV and https://github.com/graphql/graphql-js/pull/2894.
import { applyFixes } from "./graphql";

// Synchronously undo the global process.env.NODE_ENV polyfill that we created
// temporarily while importing the offending graphql/jsutils/instanceOf module.
applyFixes();
