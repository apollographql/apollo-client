import build, { globals } from '../../config/rollup.config';

const globalsOverride = {
  ...globals,
  'fast-json-stable-stringify': 'stringify',
};

export default build('apollo.utilities', {
  output: {
    globals: globalsOverride,
  },
});
