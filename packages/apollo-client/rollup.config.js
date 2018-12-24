import buildUmdConfig, { globals } from '../../config/buildUmdConfig';

const globalsOverride = {
  ...globals,
  'symbol-observable': '$$observable',
  'graphql/language/printer': 'print',
};

export default [
  buildUmdConfig('apollo.core', {
    output: {
      globals: globalsOverride,
    },
  }),
];
