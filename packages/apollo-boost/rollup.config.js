import buildUmdConfig from '../../config/buildUmdConfig';
import buildEsmConfig from '../../config/buildEsmConfig';
import pkg from './package.json';

const globals = {
  'apollo-client': 'apollo.core',
  'apollo-cache-inmemory': 'apolloCacheInMemory',
  'apollo-link': 'apolloLink.core',
  'apollo-link-http': 'apolloLinkHttp',
  'apollo-link-state': 'apolloLinkState',
  'apollo-link-error': 'apolloLinkError',
  'graphql-tag': 'graphqlTag',
  // new - not sure if correct ??
  'graphql-anywhere/lib/async': 'graphqlAnywhere.async',
  'graphql/language/printer': 'print',
  'symbol-observable': '$$observable',
  'zen-observable': 'zenObservable',
  'fast-json-stable-stringify': 'stringify',
  'graphql-tag': 'gql',
  'apollo-utilities': 'apolloUtilities',
};

export default [
  buildUmdConfig('apollo.boost', {
    external: Object.keys(globals),
    output: {
      globals,
    },
  }),
  buildEsmConfig(pkg),
];
