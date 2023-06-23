import { distDir, eachFile } from './helpers';

// The primary goal of the 'npm run resolve' script is to make ECMAScript
// modules exposed by Apollo Client easier to consume natively in web browsers,
// without bundling, and without help from package.json files. It accomplishes
// this goal by rewriting internal ./ and ../ (relative) imports to refer to a
// specific ESM module (not a directory), including its file extension. Because
// of this limited goal, this script only touches ESM modules that have .js file
// extensions, not .cjs CommonJS bundles.

// A secondary goal of this script is to enforce that any module using the
// __DEV__ global constant imports the @apollo/client/utilities/globals polyfill
// module first.

eachFile(distDir, (file, relPath) => new Promise((resolve, reject) => {
  resolve(file);

    // all the transformer did here was to add `.js` or `/index.js` to the end
    // of relative imports (and the one external import 'ts-invariant/process')
    // and track those imports for the `__DEV__` check below

    // since we have all the file extensions in the src directory now, we can
    // skip that part
    // and the other PR will remove the __DEV__ check, so this whole file can
    // soon be removed
}));


