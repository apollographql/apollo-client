import nodeResolve from '@rollup/plugin-node-resolve';
import { terser as minify } from 'rollup-plugin-terser';
import path from 'path';

const packageJson = require('../package.json');
const entryPoints = require('./entryPoints');

const distDir = './dist';

function isExternal(id) {
  return !(id.startsWith("./") || id.startsWith("../"));
}

function prepareCJS(input, output) {
  return {
    input,
    external(id) {
      return isExternal(id);
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
      return isExternal(id) || entryPoints.check(id, parentId);
    },
    output: {
      file: `${dir}/${bundleName}.cjs.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      externalLiveBindings: false,
      // In Node.js, where these CommonJS bundles are most commonly used,
      // the expression process.env.NODE_ENV can be very expensive to
      // evaluate, because process.env is a wrapper for the actual OS
      // environment, and lookups are not cached. We need to preserve the
      // syntax of process.env.NODE_ENV expressions for dead code
      // elimination to work properly, but we can apply our own caching by
      // shadowing the global process variable with a stripped-down object
      // that saves a snapshot of process.env.NODE_ENV when the bundle is
      // first evaluated. If we ever need other process properties, we can
      // add more stubs here.
      intro: '!(function (process) {',
      outro: [
        '}).call(this, {',
        '  env: {',
        '    NODE_ENV: typeof process === "object"',
        '      && process.env',
        '      && process.env.NODE_ENV',
        '      || "development"',
        '  }',
        '});',
      ].join('\n'),
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
