import nodeResolve from '@rollup/plugin-node-resolve';
import { terser as minify } from 'rollup-plugin-terser';
import path from 'path';

const packageJson = require('../package.json');
const entryPoints = require('./entryPoints');

const distDir = './dist';

function isExternal(id, parentId, entryPointsAreExternal = true) {
  // Rollup v2.26.8 started passing absolute id strings to this function, thanks
  // apparently to https://github.com/rollup/rollup/pull/3753, so we relativize
  // the id again in those cases.
  if (path.posix.isAbsolute(id)) {
    id = path.posix.relative(
      path.posix.dirname(parentId),
      id,
    );
    if (!id.startsWith(".")) {
      id = "./" + id;
    }
  }

  const isRelative =
    id.startsWith("./") ||
    id.startsWith("../");

  if (!isRelative) {
    return true;
  }

  if (entryPointsAreExternal &&
      entryPoints.check(id, parentId)) {
    return true;
  }

  return false;
}

function prepareCJS(input, output) {
  return {
    input,
    external(id, parentId) {
      return isExternal(id, parentId, false);
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
            '@__DEV__': 'false',
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
      return isExternal(id, parentId, true);
    },
    output: {
      file: `${dir}/${bundleName}.cjs.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      interop: 'esModule',
      externalLiveBindings: false,
    },
    plugins: [
      extensions ? nodeResolve({ extensions }) : nodeResolve(),
    ],
  };
}

export default [
  ...entryPoints.map(prepareBundle),
  // Convert the ESM entry point to a single CJS bundle.
  prepareCJS(
    './dist/core/index.js',
    './dist/apollo-client.cjs.js',
  ),
  // Minify that single CJS bundle.
  prepareCJSMinified(
    './dist/apollo-client.cjs.js',
  ),
];
