export const globals = {
  // Apollo
  'apollo-client': 'apollo.core',
  'apollo-cache': 'apolloCache.core',
  'apollo-link': 'apolloLink.core',
  'apollo-link-dedup': 'apolloLink.dedup',
  'apollo-utilities': 'apollo.utilities',
  'graphql-anywhere': 'graphqlAnywhere',
};

export default (name, override = {}) =>
  Object.assign(
    {
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
    },
    override,
  );

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
