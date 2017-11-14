import resolve from 'rollup-plugin-node-resolve';

import build from '../../rollup.config';

export default Object.assign(
  {
    plugins: [resolve()],
  },
  build('apollo.cache.core'),
);
