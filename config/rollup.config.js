import nodeResolve from '@rollup/plugin-node-resolve';
import { terser as minify } from 'rollup-plugin-terser';

const packageJson = require('../package.json');
const entryPoints = require('./entryPoints');

const distDir = './dist';

const external = [
  '@wry/context',
  '@wry/equality',
  'fast-json-stable-stringify',
  'graphql-tag',
  'graphql/execution/execute',
  'graphql/language/printer',
  'graphql/language/visitor',
  'hoist-non-react-statics',
  'optimism',
  'prop-types',
  'react',
  'subscriptions-transport-ws',
  'symbol-observable',
  'ts-invariant',
  'tslib',
  'zen-observable',
];

function prepareCJS(input, output) {
  return {
    input,
    external,
    output: {
      file: output,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      nodeResolve(),
      // When generating the `dist/core/core.cjs.js` entry point (in
      // `config/prepareDist.js`), we filter and re-export the exports we
      // need from the main Apollo Client CJS bundle (to exclude React related
      // code). This means that consumers of `core.cjs.js` attempt to load the
      // full AC CJS bundle first (before filtering exports), which then means
      // the React require in the AC CJS bundle is attempted and not found
      // (since people using `core.cjs.js` want to use Apollo Client without
      // React). To address this, we make React an optional require in the CJS
      // bundle.
      (() => {
        const cjsBundle = output.replace(`${distDir}/`, '');
        return {
          generateBundle(_option, bundle) {
            const parts = bundle[cjsBundle].code.split(
              /var React = require\('react'\);/);
            // The React import should appear only once in the CJS bundle,
            // since we build the CJS bundle using Rollup, which (hopefully!)
            // deduplicates all external imports.
            if (parts && parts.length === 2) {
              bundle[cjsBundle].code = [
                parts[0],
                "try { var React = require('react'); } catch (error) {}",
                parts[1],
              ].join("\n");
            } else {
              throw new Error(
                'The CJS bundle could not be prepared as a single React ' +
                'require could not be found.'
              );
            }
          }
        }
      })()
    ],
  };
}

function prepareCJSMinified(input) {
  return {
    input,
    output: {
      file: input.replace('.js', '.min.js'),
      format: 'cjs',
    },
    plugins: [
      minify({
        mangle: {
          toplevel: true,
        },
        compress: {
          toplevel: true,
          global_defs: {
            '@process.env.NODE_ENV': JSON.stringify('production'),
          },
        },
      }),
    ],
  };
}

function prepareBundle({
  dirs,
  bundleName = dirs[dirs.length - 1],
  extensions,
}) {
  const dir = path.join(distDir, ...dirs);
  return {
    input: `${dir}/index.js`,
    external,
    output: {
      file: `${dir}/${bundleName}.cjs.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      extensions ? nodeResolve({ extensions }) : nodeResolve(),
    ],
  };
}

export default [
  prepareCJS(packageJson.module, packageJson.main),
  prepareCJSMinified(packageJson.main),
  ...entryPoints.map(prepareBundle),
];
