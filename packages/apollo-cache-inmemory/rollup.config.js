import buildUmdConfig, { globals } from '../../config/buildUmdConfig';
import buildEsmConfig from '../../config/buildEsmConfig';
import pkg from './package.json';

const globalsOverride = {
  ...globals,
  'graphql/language/printer': 'print',
  optimism: 'optimism',
  'graphql/language/visitor': 'visitor',
};

export default [
  buildUmdConfig('apollo.cache.inmemory', {
    output: {
      globals: globalsOverride,
    },
  }),
  buildEsmConfig(pkg),
];
