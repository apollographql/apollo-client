import { rollup } from '../../config/rollup.config';

export default rollup({
  name: 'apollo-boost',
  extraGlobals: {
    'apollo-cache-inmemory': 'apolloCacheInMemory',
    'apollo-link': 'apolloLink.core',
    'apollo-link-http': 'apolloLinkHttp',
    'apollo-link-error': 'apolloLinkError',
    'graphql-tag': 'graphqlTag',
  },
});
