import nodeResolve from 'rollup-plugin-node-resolve';
import typescriptPlugin from 'rollup-plugin-typescript2';
import typescript from 'typescript';
import path from 'path';
import fs from 'fs';
import { transformSync } from '@babel/core';
import cjsModulesTransform from '@babel/plugin-transform-modules-commonjs';
import umdModulesTransform from '@babel/plugin-transform-modules-umd';
import invariantPlugin from 'rollup-plugin-invariant';
import { terser as minify } from 'rollup-plugin-terser';
import replace from 'rollup-plugin-replace';
import { main as mainBundle } from '../package.json';

const hasOwn = Object.prototype.hasOwnProperty;

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}

const defaultGlobals = {
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

function rollup({
  input = './src/index.ts',
  outputPrefix = 'apollo-client',
  extraGlobals = {},
} = {}) {
  const projectDir = path.join(__dirname, '..');
  const tsconfig = `${projectDir}/tsconfig.json`;

  const globals = {
    ...defaultGlobals,
    ...extraGlobals,
  };

  function external(id) {
    return hasOwn.call(globals, id);
  }

  function outputFile(format) {
    return `./lib/${outputPrefix}.${format}.js`;
  }

  function fromSource(format) {
    return {
      input,
      external,
      output: {
        file: outputFile(format),
        format,
        sourcemap: true,
      },
      plugins: [
        nodeResolve({
          extensions: ['.ts', '.tsx'],
        }),
        typescriptPlugin({ typescript, tsconfig }),
        invariantPlugin({
          // Instead of completely stripping InvariantError messages in
          // production, this option assigns a numeric code to the
          // production version of each error (unique to the call/throw
          // location), which makes it much easier to trace production
          // errors back to the unminified code where they were thrown,
          // where the full error string can be found. See #4519.
          errorCodes: true,
        }),
      ],
      onwarn,
    };
  }

  function fromESM(toFormat) {
    return {
      input: outputFile('esm'),
      output: {
        file: outputFile(toFormat),
        format: 'esm',
        sourcemap: false,
      },
      // The UMD bundle expects `this` to refer to the global object. By default
      // Rollup replaces `this` with `undefined`, but this default behavior can
      // be overridden with the `context` option.
      context: 'this',
      plugins: [
        {
          transform(source, id) {
            const output = transformSync(source, {
              inputSourceMap: JSON.parse(fs.readFileSync(id + '.map')),
              sourceMaps: true,
              plugins: [
                [toFormat === 'umd' ? umdModulesTransform : cjsModulesTransform, {
                  loose: true,
                  allowTopLevelThis: true,
                }],
              ],
            });

            // There doesn't seem to be any way to get Rollup to emit a source map
            // that goes all the way back to the source file (rather than just to
            // the bundle.esm.js intermediate file), so we pass sourcemap:false in
            // the output options above, and manually write the CJS and UMD source
            // maps here.
            fs.writeFileSync(
              outputFile(toFormat) + '.map',
              JSON.stringify(output.map),
            );

            return {
              code: output.code,
            };
          }
        }
      ]
    }
  }

  return [
    fromSource('esm'),
    fromESM('cjs'),
    fromESM('umd'),
    {
      input: outputFile('cjs'),
      output: {
        file: outputFile('cjs.min'),
        format: 'esm',
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
      ]
    }
  ];
}

// Build a separate CJS only `testing.js` bundle, that includes React
// testing utilities like `MockedProvider` (testing utilities are kept out of
// the main `apollo-client` bundle). This bundle can be accessed directly
// like:
//
// import { MockedProvider } from '@apollo/client/lib/testing';
//
// Note: The `ApolloProvider` reference is marked as being global so it can
// then be replaced with a hard coded path to the `apollo-client.cjs.js`
// bundle. This is done to ensure that when using this bundle `MockedProvider`
// always uses the same `ApolloProvider` instance as the rest of the
// application under test. This means they'll share the exact same React
// context, and be able to share the same Apollo Client instance stored in that
// context.
function rollupTesting() {
  const globals = {
    ...defaultGlobals,
    '../../context/ApolloProvider': 'ApolloProvider'
  };

  const output = {
    file: './lib/testing.js',
    format: 'cjs',
  };

  return [
    {
      input: './src/react/testing/index.ts',
      external: (id) => hasOwn.call(globals, id),
      output,
      plugins: [
        nodeResolve({
          extensions: ['.ts', '.tsx'],
        }),
        typescriptPlugin({
          typescript,
          tsconfig: `${path.join(__dirname, '..')}/tsconfig.json`
        }),
      ],
    },
    {
      input: output.file,
      output,
      plugins: [
        replace({
          'context/ApolloProvider': mainBundle
        }),
      ],
    },
  ];
}

export default rollup().concat(rollupTesting());
