import build, { globals } from '../../config/rollup.config';

const globalsOverride = {
  ...globals,
  'symbol-observable': '$$observable',
  'graphql/language/printer': 'print',
};

export default build('apollo.core', {
  output: {
    globals: globalsOverride,
  },
});
