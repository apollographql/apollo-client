import build from '../../config/rollup.config';

const globals = {
  'apollo-client': 'apollo.core',
  'apollo-cache-inmemory': 'apolloCacheInMemory',
  'apollo-link': 'apolloLink.core',
  'apollo-link-http': 'apolloLinkHttp',
  'apollo-link-state': 'apolloLinkState',
  'apollo-link-error': 'apolloLinkError',
  'graphql-tag': 'graphqlTag',
};

export default build('apollo.boost', {
  external: Object.keys(global),
  output: {
    file: 'lib/index.umd.js',
    globals,
  },
});
