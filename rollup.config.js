export const globals = {
  // Apollo
  'apollo-client': 'apollo.core',
  'apollo-cache': 'apollo.cache.core',
  'apollo-link': 'apollo.link.core',
  'apollo-link-dedup': 'apollo.link.dedup',
  'apollo-utilities': 'apollo.utilities',
  'graphql-anywhere': 'graphqlAnywhere',
};

export default name => ({
  input: 'lib/index.js',
  output: {
    file: 'lib/bundle.umd.js',
    format: 'umd',
  },
  name,
  exports: 'named',
  sourcemap: true,
  external: Object.keys(globals),
  onwarn,
  globals,
});

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
