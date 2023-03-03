import path from 'path';
import { promises as fs } from "fs";
import type { NormalizedOutputOptions, OutputBundle, RollupOptions } from 'rollup';
import terser from '@rollup/plugin-terser';
import * as entryPoints from './entryPoints.js'

const distDir = './dist';

function isExternal(id: string, parentId?: string, entryPointsAreExternal = true) {
  let posixId = toPosixPath(id)
  const posixParentId = parentId ? toPosixPath(parentId) : "/";
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
function toPosixPath(p: string) {
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

function prepareCJS(input: string, output: string): RollupOptions {
  return {
    input,
    external(id: string, parentId?: string) {
      return isExternal(id, parentId, false);
    },
    output: {
      file: output,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      externalLiveBindings: false,
    },
  };
}

function prepareCJSMinified(input: string): RollupOptions {
  return {
    input,
    output: {
      file: input.replace('.cjs', '.min.cjs'),
      format: 'cjs',
    },
    plugins: [
      // TypeScript does not seem to understand functions that are exported
      // as default, so it believes that terser is not callable. We know that
      // it is, so we disable the type check here.
      // @ts-ignore
      terser({
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
}: entryPoints.EntryPoint): RollupOptions {
  const dir = path.join(distDir, ...dirs);
  const inputFile = `${dir}/index.js`;
  const outputFile = `${dir}/${bundleName}.cjs`;

  return {
    input: inputFile,
    external(id: string, parentId?: string) {
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
      {
        name: "update index.js imports to <bundleName>.cjs in *.cjs files",
        generateBundle(options: NormalizedOutputOptions, bundle: OutputBundle, isWrite: boolean) {
          const regex = /require\(\'(\..*)\/([^/]+)\/(index\.js)\'\)/gm;
          const replacement = "require('$1/$2/$2.cjs')"
          for (const file in bundle) {
            const chunk = bundle[file]
            if ('code' in chunk) {
              chunk.code = chunk.code.replace(regex, replacement)
            }
          }
        }
      },
      {
        // TODO do the imports need to be changed to the native versions?
        name: "copy *.cjs to *.cjs.native.js",
        async writeBundle({ file }: { file?: string }) {
          if (file) {
            const buffer = await fs.readFile(file);
            await fs.writeFile(
              file + ".native.js",
              buffer,
            );
          }
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
