import sourcemaps from 'rollup-plugin-sourcemaps';
import nodeResolve from 'rollup-plugin-node-resolve';
import typescriptPlugin from 'rollup-plugin-typescript2';
import commonjs from 'rollup-plugin-commonjs';
import typescript from 'typescript';
import path from 'path';

const extensions = ['.ts', '.tsx'];
const input = './src/index.ts';

export const globals = {
  // Apollo
  'apollo-client': 'apollo.core',
  'apollo-cache': 'apolloCache.core',
  'apollo-link': 'apolloLink.core',
  'apollo-link-dedup': 'apolloLink.dedup',
  'apollo-utilities': 'apollo.utilities',
  'graphql-anywhere': 'graphqlAnywhere',
  'graphql-anywhere/lib/async': 'graphqlAnywhere.async',
  'apollo-boost': 'apollo.boost',
};

const commonjsOptions = {
  include: 'node_modules/**',
};

export default (name, override = { output: { globals: {} } }) => {
  const projectDir = path.join(__filename, '..');
  console.info(`Building project umd ${projectDir}`);
  const tsconfig = `${projectDir}/tsconfig.json`;
  const config = Object.assign(
    {
      input,
      //output: merged separately
      onwarn,
      external: Object.keys({ ...globals, ...override.output.globals }),
      plugins: [
        nodeResolve({ extensions }),
        typescriptPlugin({ typescript, tsconfig }),
        commonjs(commonjsOptions),
      ],
    },
    override,
  );

  config.output = Object.assign(
    {
      file: 'lib/bundle.umd.js',
      format: 'umd',
      name,
      exports: 'named',
      sourcemap: true,
      globals,
    },
    config.output,
  );

  config.plugins = config.plugins || [];
  config.plugins.push(
    sourcemaps(),
    nodeResolve({
      // Inline anything imported from the tslib package, e.g. __extends
      // and __assign. This depends on the "importHelpers":true option in
      // tsconfig.base.json.
      module: true,
      only: ['tslib'],
    }),
  );

  return config;
};

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
