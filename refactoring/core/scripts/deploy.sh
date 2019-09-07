#!/bin/sh -e
cd "$(dirname "$0")" && cd ../

# When we publish to npm, the published files are available in the root
# directory, which allows for a clean include or require of sub-modules.
#
#    var language = require('apollo-client/parser');
#

# Clear the built output
rm -rf ./lib

node -e "var package = require('./package.json'); \
    var fs = require('fs');
    fs.writeFileSync('./src/version.ts', 'export const version = \"' + package.version + '\"')
"

# Compile new files
npm run build

# Make sure the ./npm directory is empty
rm -rf ./npm
mkdir ./npm

# Copy all files from ./lib/src to /npm
cd ./lib && cp -r ./ ../npm/
# Copy also the umd bundle with the source map file
cp bundle.umd.js ../npm/ && cp bundle.umd.js.map ../npm/

# Back to the root directory
cd ../

# Ensure a vanilla package.json before deploying so other tools do not
# interpret the built output as requiring any further transformation.
# Also make sure that "file:.." based dependency references are replaced
# with actual version numbers.
node -e "\
  var apolloCachePackage = require('../apollo-cache/package.json'); \
  var apolloCacheVersion = apolloCachePackage.version; \
  var apolloUtilitiesPackage = require('../apollo-utilities/package.json'); \
  var apolloUtilitiesVersion = apolloUtilitiesPackage.version; \
  var package = require('./package.json'); \
  delete package.babel; \
  delete package.jest; \
  delete package.private; \
  delete package.scripts; \
  delete package.options; \
  package.main = 'bundle.umd.js'; \
  package.module = 'bundle.esm.js'; \
  package.typings = 'index.d.ts'; \
  package.dependencies['apollo-cache'] = apolloCacheVersion; \
  package.dependencies['apollo-utilities'] = apolloUtilitiesVersion; \
  var origVersion = 'local';
  var fs = require('fs'); \
  fs.writeFileSync('./npm/version.js', 'exports.version = \"' + package.version + '\"'); \
  fs.writeFileSync('./npm/package.json', JSON.stringify(package, null, 2)); \
  fs.writeFileSync('./src/version.ts', 'export const version = \'' + origVersion + '\';');
"

# Copy few more files to ./npm
cp ../../README.md npm/
cp ../../LICENSE npm/

cd npm && npm publish
