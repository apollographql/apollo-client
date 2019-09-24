import nodeResolve from 'rollup-plugin-node-resolve';
import invariantPlugin from 'rollup-plugin-invariant';
import { terser as minify } from 'rollup-plugin-terser';

import packageJson from '../package.json';

const globals = {
  'apollo-link': 'apolloLink.core',
  'tslib': 'tslib',
  'ts-invariant': 'invariant',
  'symbol-observable': '$$observable',
  'graphql/language/printer': 'print',
  optimism: 'optimism',
  'graphql/language/visitor': 'visitor',
  'fast-json-stable-stringify': 'stringify',
  '@wry/equality': 'wryEquality',
  graphql: 'graphql',
  react: 'React'
};

function external(id) {
  return Object.prototype.hasOwnProperty.call(globals, id);
}

function prepareESM() {
  return {
    input: packageJson.module,
    external,
    preserveModules: true,
    output: {
      dir: './dist',
      format: 'esm',
      sourcemap: true,
    },
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

function rollup() {
  return [
    prepareESM(),
    prepareCJS(),
    prepareCJSMinified()
  ];
}

export default rollup();
