import nodeResolve from 'rollup-plugin-node-resolve';
import invariantPlugin from 'rollup-plugin-invariant';
import { terser as minify } from 'rollup-plugin-terser';
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
    }
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
// Note: The `ApolloProvider` reference is marked as being global so it can
// then be replaced with a hard coded path to the `apollo-client.cjs.js`
// bundle. This is done to ensure that when using this bundle `MockedProvider`
// always uses the same `ApolloProvider` instance as the rest of the
// application under test. This means they'll share the exact same React
// context, and be able to share the same Apollo Client instance stored in that
// context.
function prepareTesting() {
  const bundleName = 'testing';
  const apolloProviderPath = 'context/ApolloProvider';

  const testingGlobals = {
    ...globals,
    [`../../${apolloProviderPath}`]: 'ApolloProvider'
  };

  const output = {
    file: `${distDir}/${bundleName}.js`,
    format: 'cjs',
  };

  // Create a type file for the new testing bundle that points to the existing
  // `react/testing` type definitions.
  fs.writeFileSync(
    `${distDir}/${bundleName}.d.ts`,
    "export * from './react/testing';"
  );

  return {
    input: `${distDir}/react/testing/index.js`,
    external: (id) => hasOwn.call(testingGlobals, id),
    output,
    plugins: [
      nodeResolve({
        extensions: ['.js', '.jsx'],
      }),
      // Update the external ApolloProvider require in the testing bundle
      // to point to the main Apollo Client CJS bundle, to make sure the
      // testing bundle uses the exact same ApolloProvider as the main
      // AC CJS bundle. This helps ensure the same React Context is used
      // by both React testing utilities and the application under test.
      (() => {
        const bundleJs = `${bundleName}.js`;
        return {
          generateBundle(_option, bundle) {
            bundle[bundleJs].code =
              bundle[bundleJs].code.replace(
                `../${apolloProviderPath}`,
                packageJson.main.replace(distDir, '.')
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
