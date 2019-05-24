import nodeResolve from 'rollup-plugin-node-resolve';
import typescriptPlugin from 'rollup-plugin-typescript2';
import typescript from 'typescript';
import path from 'path';
import invariantPlugin from 'rollup-plugin-invariant';
import { terser as minify } from 'rollup-plugin-terser';

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}

const defaultGlobals = {
  'apollo-client': 'apollo.core',
  'apollo-cache': 'apolloCache.core',
  'apollo-link': 'apolloLink.core',
  'apollo-link-dedup': 'apolloLink.dedup',
  'apollo-utilities': 'apollo.utilities',
  'graphql-anywhere': 'graphqlAnywhere',
  'graphql-anywhere/lib/async': 'graphqlAnywhere.async',
  'apollo-boost': 'apollo.boost',
  'tslib': 'tslib',
  'ts-invariant': 'invariant',
};

export function rollup({
  name,
  input = './src/index.ts',
  outputPrefix = 'bundle',
  extraGlobals = {},
}) {
  const projectDir = path.join(__filename, '..');
  console.info(`Building project esm ${projectDir}`);
  const tsconfig = `${projectDir}/tsconfig.json`;

  const globals = {
    ...defaultGlobals,
    ...extraGlobals,
  };

  function external(id) {
    return Object.prototype.hasOwnProperty.call(globals, id);
  }

  function outputFile(format) {
    return './lib/' + outputPrefix + '.' + format + '.js';
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
          module: true,
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
        sourcemap: true,
      },
      plugins: [{
        transform(source, id) {
          const output = typescript.transpileModule(source, {
            compilerOptions: {
              // This code has already been compiled to ES5+modules, so we don't
              // need to compile all the way to ES5 again.
              target: 'es2018',
              module: toFormat,
              // Since we already import helpers from tslib in the .esm.js
              // bundle, importing helpers at this step tends to duplicate the
              // require('tslib') call. Since we should only need helpers for
              // importing and exporting, it should be fine to inline them.
              // importHelpers: true,
              allowJs: true,
              checkJs: false,
              sourceMap: true,
            },
          });

          return {
            code: output.outputText,
            // Note: this is the source map from the .esm.js bundle to the
            // .cjs.js or .umd.js output bundle. We should compose the TS-ESM
            // and ESM-CJS source maps together, ideally, but I haven't been
            // able to get that to work yet.
            map: output.sourceMapText,
          };
        }
      }],
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
      ],
    },
  ];
}
