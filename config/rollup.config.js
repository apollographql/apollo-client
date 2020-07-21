import nodeResolve from '@rollup/plugin-node-resolve';
import { terser as minify } from 'rollup-plugin-terser';
import path from 'path';

const packageJson = require('../package.json');
const entryPoints = require('./entryPoints');

const distDir = './dist';

const externalPackages = new Set([
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
]);

function prepareCJS(input, output) {
  return {
    input,
    external(id) {
      return externalPackages.has(id);
    },
    output: {
      file: output,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      externalLiveBindings: false,
    },
    plugins: [
      nodeResolve(),
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
    external(id, parentId) {
      return externalPackages.has(id) ||
        entryPoints.check(id, parentId);
    },
    output: {
      file: `${dir}/${bundleName}.cjs.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      externalLiveBindings: false,
    },
    plugins: [
      extensions ? nodeResolve({ extensions }) : nodeResolve(),
    ],
  };
}

// Resolve indirect imports and exports to the original exporting module,
// so that more imports are explicitly named (fewer *s), and all source
// module identifiers have file extensions.
function resolveESMImportsAndFileExtensions(input, outputDir) {
  return {
    input,
    external(id) {
      return externalPackages.has(id);
    },
    output: {
      dir: outputDir,
      format: 'esm',
      sourcemap: true,
    },
    // By setting preserveModules to true, we're making sure Rollup
    // doesn't attempt to create a single combined ESM bundle with the
    // final result of running this job.
    preserveModules: true,
    plugins: [
      nodeResolve(),
    ],
  };
}

export default [
  ...entryPoints.map(prepareBundle),
  // Convert the ESM entry point to a single CJS bundle.
  prepareCJS(
    './dist/index.js',
    './dist/apollo-client.cjs.js',
  ),
  // Minify that single CJS bundle.
  prepareCJSMinified(
    './dist/apollo-client.cjs.js',
  ),
  resolveESMImportsAndFileExtensions(packageJson.module, distDir),
];
