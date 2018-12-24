import buildUmdConfig, { globals } from '../../config/buildUmdConfig';

const globalsOverride = {
  ...globals,
  'fast-json-stable-stringify': 'stringify',
};

export default [
  buildUmdConfig('apollo.utilities', {
    output: {
      globals: globalsOverride,
    },
  }),
];
