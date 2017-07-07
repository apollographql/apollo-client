#!/bin/sh -e


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
npm run compile

# Make sure the ./npm directory is empty
rm -rf ./npm
mkdir ./npm

# Copy all files from ./lib/src to /npm
cd ./lib/src && cp -r ./ ../../npm/
# Copy also the umd bundle with the source map file
cd ../
cp apollo.umd.js ../npm/ && cp apollo.umd.js.map ../npm/

# Back to the root directory
cd ../

# Ensure a vanilla package.json before deploying so other tools do not interpret
# The built output as requiring any further transformation.
node -e "var package = require('./package.json'); \
  delete package.babel; \
  delete package.scripts; \
  delete package.options; \
  package.main = 'apollo.umd.js'; \
  package.module = 'index.js'; \
  package['jsnext:main'] = 'index.js'; \
  package.typings = 'index.d.ts'; \
  var origVersion = 'local';
  var fs = require('fs'); \
  fs.writeFileSync('./npm/version.js', 'exports.version = \"' + package.version + '\"'); \
  fs.writeFileSync('./npm/package.json', JSON.stringify(package, null, 2)); \
  fs.writeFileSync('./src/version.ts', 'export const version = \'' + origVersion + '\';');
  "


# Copy few more files to ./npm
cp README.md npm/
cp LICENSE npm/
cp index.js.flow npm/

echo 'deploying to npm...'
cd npm && npm publish && git push --tags
