import buildUmdConfig, { globals } from '../../config/buildUmdConfig';
import buildEsmConfig from '../../config/buildEsmConfig';
import pkg from './package.json';

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
  buildEsmConfig(pkg),
];
