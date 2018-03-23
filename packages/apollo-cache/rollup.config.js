import resolve from 'rollup-plugin-node-resolve';

import build from '../../rollup.config';

export default build('apollo.cache.core', {
  plugins: [resolve()],
});
