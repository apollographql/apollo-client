import path from 'path';
import { promises as fs } from "fs";

import nodeResolve from '@rollup/plugin-node-resolve';
import { terser as minify } from 'rollup-plugin-terser';

const entryPoints = require('./entryPoints');
const distDir = './dist';

function isExternal(id, parentId, entryPointsAreExternal = true) {
  let posixId = toPosixPath(id)
  const posixParentId = toPosixPath(parentId);
  // Rollup v2.26.8 started passing absolute id strings to this function, thanks
  // apparently to https://github.com/rollup/rollup/pull/3753, so we relativize
  // the id again in those cases.
  if (path.isAbsolute(id)) {
    posixId = path.posix.relative(
      path.posix.dirname(posixParentId),
      posixId,
    );
    if (!posixId.startsWith(".")) {
      posixId = "./" + posixId;
    }
  }

  const isRelative =
    posixId.startsWith("./") ||
    posixId.startsWith("../");

  if (!isRelative) {
    return true;
  }

  if (entryPointsAreExternal &&
      entryPoints.check(posixId, posixParentId)) {
    return true;
  }

  return false;
}

// Adapted from https://github.com/meteor/meteor/blob/devel/tools/static-assets/server/mini-files.ts
function toPosixPath(p) {
  // Sometimes, you can have a path like \Users\IEUser on windows, and this
  // actually means you want C:\Users\IEUser
  if (p[0] === '\\') {
    p = process.env.SystemDrive + p;
  }

  p = p.replace(/\\/g, '/');
  if (p[1] === ':') {
    // Transform "C:/bla/bla" to "/c/bla/bla"
    p = '/' + p[0] + p.slice(2);
  }

  return p;
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
      file: input.replace('.cjs', '.min.cjs'),
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
            '@globalThis.__DEV__': 'false',
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
  const inputFile = `${dir}/index.js`;
  const outputFile = `${dir}/${bundleName}.cjs`;

  return {
    input: inputFile,
    external(id, parentId) {
      return isExternal(id, parentId, true);
    },
    output: {
      file: outputFile,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      externalLiveBindings: false,
    },
    plugins: [
      extensions ? nodeResolve({ extensions }) : nodeResolve(),
      {
        name: "copy *.cjs to *.cjs.native.js",
        async writeBundle({ file }) {
          const buffer = await fs.readFile(file);
          await fs.writeFile(
            file + ".native.js",
            buffer,
          );
        },
      },
    ],
  };
}

export default [
  ...entryPoints.map(prepareBundle),
  // Convert the ESM entry point to a single CJS bundle.
  prepareCJS(
    './dist/index.js',
    './dist/apollo-client.cjs',
  ),
  prepareCJSMinified(
    './dist/apollo-client.cjs',
  ),
];
