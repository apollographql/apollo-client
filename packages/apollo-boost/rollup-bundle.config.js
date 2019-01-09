import sourcemaps from 'rollup-plugin-sourcemaps';
import resolve from 'rollup-plugin-node-resolve';

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}

const globals = {
  'graphql-anywhere/lib/async': 'graphqlAnywhere.async',
  'graphql/language/printer': 'print',
  'symbol-observable': '$$observable',
  'zen-observable': 'zenObservable',
  'fast-json-stable-stringify': 'stringify',
  'graphql-tag': 'gql',
  'apollo-utilities': 'apolloUtilities',
  optimism: 'optimism',
};

export default {
  input: 'lib/index.js',
  onwarn,
  output: {
    file: 'lib/bundle.umd.js',
    format: 'umd',
    sourcemap: true,
    name: 'apollo.boost',
    globals,
    exports: 'named',
  },
  external: Object.keys(globals),
  plugins: [resolve(), sourcemaps()],
};
