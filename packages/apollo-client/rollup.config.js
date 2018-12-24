import buildUmdConfig, { globals } from '../../config/buildUmdConfig';
import buildEsmConfig from '../../config/buildEsmConfig';
import pkg from './package.json';

const globalsOverride = {
  ...globals,
  'symbol-observable': '$$observable',
};

export default [
  buildUmdConfig('apollo.core', {
    output: {
      globals: globalsOverride,
    },
  }),
  buildEsmConfig(pkg),
];
