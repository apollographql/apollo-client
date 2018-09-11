import build, { globals } from '../../config/rollup.config';

const globalsOverride = {
  ...globals,
  'graphql/language/printer': 'print',
};

export default build('apollo.cache.inmemory', {
  output: {
    globals: globalsOverride,
  },
});
