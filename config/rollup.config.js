import nodeResolve from 'rollup-plugin-node-resolve';
import invariantPlugin from 'rollup-plugin-invariant';
import { terser as minify } from 'rollup-plugin-terser';
import cjs from 'rollup-plugin-commonjs';
import fs from 'fs';

import packageJson from '../package.json';

const distDir = './dist';

const globals = {
  'tslib': 'tslib',
  'ts-invariant': 'invariant',
  'symbol-observable': '$$observable',
  'graphql/language/printer': 'print',
  optimism: 'optimism',
  'graphql/language/visitor': 'visitor',
  'graphql/execution/execute': 'execute',
  'graphql-tag': 'graphqlTag',
  'fast-json-stable-stringify': 'stringify',
  '@wry/equality': 'wryEquality',
  graphql: 'graphql',
  react: 'React',
  'zen-observable': 'Observable'
};

const hasOwn = Object.prototype.hasOwnProperty;

function external(id) {
  return hasOwn.call(globals, id);
}

function prepareESM() {
  return {
    input: packageJson.module,
    external,
    output: {
      dir: distDir,
      format: 'esm',
      sourcemap: true,
    },
    // The purpose of this job is to ensure each `./dist` ESM file is run
    // through the `invariantPlugin`, with any resulting changes added
    // directly back into each ESM file. By setting `preserveModules`
    // to `true`, we're making sure Rollup doesn't attempt to create a single
    // combined ESM bundle with the final result of running this job.
    preserveModules: true,
    plugins: [
      nodeResolve(),
      invariantPlugin({
        // Instead of completely stripping InvariantError messages in
        // production, this option assigns a numeric code to the
        // production version of each error (unique to the call/throw
        // location), which makes it much easier to trace production
        // errors back to the unminified code where they were thrown,
        // where the full error string can be found. See #4519.
        errorCodes: true,
      }),
      cjs({
        namedExports: {
          'graphql-tag': ['gql']
        }
      }),
    ]
  };
}

function prepareCJS() {
  return {
    input: packageJson.module,
    external,
    output: {
      file: packageJson.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve(),
      cjs({
        namedExports: {
          'graphql-tag': ['gql']
        }
      }),
    ]
  }
}

function prepareCJSMinified() {
  return {
    input: packageJson.main,
    output: {
      file: packageJson.main.replace('.js', '.min.js'),
      format: 'cjs',
    },
    plugins: [
      minify({
        mangle: {
          toplevel: true,
        },
        compress: {
          global_defs: {
            '@process.env.NODE_ENV': JSON.stringify('production'),
          },
        },
      }),
    ],
  };
}

// Build a separate CJS only `testing.js` bundle, that includes React
// testing utilities like `MockedProvider` (testing utilities are kept out of
// the main `apollo-client` bundle). This bundle can be accessed directly
// like:
//
// import { MockedProvider } from '@apollo/client/testing';
//
// Note: The `ApolloProvider` reference is marked as being global, and its
// import is updated to point to the ESM based `react/context/ApolloProvider`
// file, to make sure only one React context is used. This is important for
// things like being able to share the same Apollo Client instance stored in
// that context between running tests and the application under test.
function prepareTesting() {
  const bundleName = 'testing';
  const apolloProviderPath = 'react/context/ApolloProvider';

  const testingGlobals = {
    ...globals,
    [`../../../${apolloProviderPath}`]: 'ApolloProvider'
  };

  const output = {
    file: `${distDir}/${bundleName}.js`,
    format: 'cjs',
  };

  // Create a type file for the new testing bundle that points to the existing
  // `react/testing` type definitions.
  fs.writeFileSync(
    `${distDir}/${bundleName}.d.ts`,
    "export * from './utilities/testing';"
  );

  return {
    input: `${distDir}/utilities/testing/index.js`,
    external: (id) => hasOwn.call(testingGlobals, id),
    output,
    plugins: [
      nodeResolve({
        extensions: ['.js', '.jsx'],
      }),
      // Update the external ApolloProvider require in the testing bundle
      // to point to the ESM context file, to make sure we're only ever
      // creating/using one context. This helps ensure the same React Context
      // is used by both React testing utilities and the application under
      // test.
      (() => {
        const bundleJs = `${bundleName}.js`;
        return {
          generateBundle(_option, bundle) {
            bundle[bundleJs].code =
              bundle[bundleJs].code.replace(
                `../../${apolloProviderPath}`,
                `./${apolloProviderPath}`,
              );
          }
        }
      })()
    ],
  };
}

function rollup() {
  return [
    prepareESM(),
    prepareCJS(),
    prepareCJSMinified(),
    prepareTesting()
  ];
}

export default rollup();
