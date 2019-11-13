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

const distRoot = `${__dirname}/../dist`;


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
const distPackageJson = JSON.stringify(packageJson, (_key, value) => {
  if (typeof value === 'string' && value.startsWith('./dist/')) {
    const parts = value.split('/');
    parts.splice(1, 1); // remove dist
    return parts.join('/');
  }
  return value;
}, 2) + "\n";

// Save the modified package.json to "dist"
fs.writeFileSync(`${distRoot}/package.json`, distPackageJson);

// Copy supporting files into "dist"
const srcDir = `${__dirname}/..`;
const destDir = `${srcDir}/dist`;
fs.copyFileSync(`${srcDir}/README.md`,  `${destDir}/README.md`);
fs.copyFileSync(`${srcDir}/LICENSE`,  `${destDir}/LICENSE`);


/* @apollo/client/core, @apollo/client/cache */

function buildPackageJson(bundleName) {
  return JSON.stringify({
    name: `@apollo/client/${bundleName}`,
    main: `${bundleName}.cjs.js`,
    module: 'index.js',
    types: 'index.d.ts',
  }, null, 2) + "\n";
}

function loadExportNames(bundleName) {
  const indexSrc =
    fs.readFileSync(`${distRoot}/${bundleName}/index.js`);
  const exportNames = [];
  recast.visit(recast.parse(indexSrc), {
    visitExportSpecifier(path) {
      exportNames.push(path.value.exported.name);
      return false;
    },
  });
  return exportNames;
}

function writeCjsIndex(bundleName, exportNames, includeNames = true) {
  const filterPrefix = includeNames ? '' : '!';
  fs.writeFileSync(`${distRoot}/${bundleName}/${bundleName}.cjs.js`, [
    "const allExports = require('../apollo-client.cjs');",
    `const names = new Set(${JSON.stringify(exportNames)});`,
    "Object.keys(allExports).forEach(name => {",
    `  if (${filterPrefix}names.has(name)) {`,
    "    exports[name] = allExports[name];",
    "  }",
    "});",
    "",
  ].join('\n'));
}

// Create `core` and `cache` bundle package.json files, storing them in their
// associated dist directory. This helps provide a way for the Apollo Client
// core to be used without React (via `@apollo/client/core`), and the cache
// to be used by itself (via `@apollo/client/cache`). Also create
// `core.cjs.js` and `cache.cjs.js` CommonJS entry point files that only
// include the exports needed for each bundle.

fs.writeFileSync(`${distRoot}/core/package.json`, buildPackageJson('core'));
writeCjsIndex('core', loadExportNames('react'), false);

fs.writeFileSync(`${distRoot}/cache/package.json`, buildPackageJson('cache'));
writeCjsIndex('cache', loadExportNames('cache'));
