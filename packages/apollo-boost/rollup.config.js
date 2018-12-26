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
  // new - not sure if correct
  // 'graphql/language/printer': 'print',
  // 'graphql/language': 'graphqlLanguage',
  // 'graphql-anywhere/lib/async': 'graphqlAnywhere.async',
};

export default [
  buildUmdConfig('apollo.boost', {
    external: Object.keys(global),
    output: {
      globals,
    },
  }),
  buildEsmConfig(pkg),
];
