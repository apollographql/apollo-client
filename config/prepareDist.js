// The Apollo Client source that is published to npm is located in the
// "dist" directory. This utility script is called just before deploying
// Apollo Client, to make sure the "dist" directory is prepared for publishing.
//
// This script will:
//
// - Copy the current root package.json into "dist" after adjusting it for
//   publishing.
// - Copy the root README.md into "dist"

const packageJson = require('../package.json');
const fs = require('fs');

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

// Copy the README into "dist"
fs.copyFileSync(`${__dirname}/../README.md`,  `${__dirname}/../dist/README.md`);
