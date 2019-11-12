// The Apollo Client source that is published to npm is located in the
// "dist" directory. This utility script is called when building Apollo Client,
// to make sure the "dist" directory is prepared for publishing.
//
// This script will:
//
// - Copy the current root package.json into "dist" after adjusting it for
//   publishing.
// - Copy the supporting files from the root into "dist" (e.g. `README.MD`,
//   `LICENSE`, etc.).
// - Create a new `package.json` for each sub-set bundle we support, and
//   store it in the appropriate dist sub-directory.

const fs = require('fs');
const recast = require('recast');


/* @apollo/client */

const packageJson = require('../package.json');

// The root package.json is marked as private to prevent publishing
// from happening in the root of the project. This sets the package back to
// public so it can be published from the "dist" directory.
packageJson.private = false;

// Remove package.json items that we don't need to publish
delete packageJson.scripts;
delete packageJson.bundlesize;

// The root package.json points to the CJS/ESM source in "dist", to support
// on-going package development (e.g. running tests, supporting npm link, etc.).
// When publishing from "dist" however, we need to update the package.json
// to point to the files within the same directory.
const distPackageJson = JSON.stringify(
  packageJson,
  (_key, value) => (
    typeof value === 'string' ? value.replace(/\.\/dist\//, '') : value
  ),
  2
);

// Save the modified package.json to "dist"
fs.writeFileSync(`${__dirname}/../dist/package.json`, distPackageJson);

// Copy supporting files into "dist"
const srcDir = `${__dirname}/..`;
const destDir = `${srcDir}/dist`;
fs.copyFileSync(`${srcDir}/README.md`,  `${destDir}/README.md`);
fs.copyFileSync(`${srcDir}/LICENSE`,  `${destDir}/LICENSE`);


/* @apollo/client/core */

function buildPackageJson(bundleName) {
  return JSON.stringify({
    name: `@apollo/client/${bundleName}`,
    main: `${bundleName}.cjs.js`,
    module: 'index.js',
    types: 'index.d.ts',
  }, null, 2);
}

// Create a `core` bundle package.json, storing it in the dist core
// directory. This helps provide a way for Apollo Client to be used without
// React, via `@apollo/client/core`.
fs.writeFileSync(
  `${__dirname}/../dist/core/package.json`,
  buildPackageJson('core')
);

// Build a new `core.cjs.js` entry point file, that includes everything
// except the exports listed in `src/react/index.ts`. Copy this file into
// the `dist/core` directory, to allow Apollo Client core only imports
// using `@apollo/client/core`.

const reactIndexSrc = fs.readFileSync(`${__dirname}/../dist/react/index.js`);
const reactExports = [];
const ast = recast.parse(reactIndexSrc);
recast.visit(ast, {
  visitExportSpecifier(path) {
    reactExports.push(path.value.exported.name);
    return false;
  }
});

const coreCjs = [
  "const allExports = require('../apollo-client.cjs');",
  `const filteredExports =
    Object.keys(allExports)
      .filter(key => !['${reactExports.join("', '")}'].includes(key))
      .reduce((acc, key) => {
        acc[key] = allExports[key];
        return acc;
      }, {});`,
  "module.exports = filteredExports;"
].join('\n');

fs.writeFileSync(
  `${__dirname}/../dist/core/core.cjs.js`,
  coreCjs
);
