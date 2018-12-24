import resolve from 'rollup-plugin-node-resolve';

import buildUmdConfig from '../../config/buildUmdConfig';

export default [
  buildUmdConfig('apollo.cache.core', {
    plugins: [resolve()],
  }),
];
