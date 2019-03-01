import build, { globals } from '../../config/rollup.config';

const globalsOverride = {
  ...globals,
  'graphql/language/printer': 'print',
  optimism: 'optimism',
  'graphql/language/visitor': 'visitor',
};

export default build('apollo.cache.inmemory', {
  output: {
    globals: globalsOverride,
  },
});
