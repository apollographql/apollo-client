// Most JavaScript environments do not need the workarounds implemented in
// fixPolyfills.native.ts, so importing fixPolyfills.ts merely imports
// this empty module, adding nothing to bundle sizes or execution times.
// When bundling for React Native, we substitute fixPolyfills.native.js
// for fixPolyfills.js (see the "react-native" section of package.json),
// to work around problems with Map and Set polyfills in older versions of
// React Native (which should have been fixed in react-native@0.59.0):
// https://github.com/apollographql/apollo-client/pull/5962
