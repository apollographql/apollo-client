import { rollup } from '../../config/rollup.config';

export default rollup({
  name: 'apollo-client',
  extraGlobals: {
    'symbol-observable': '$$observable',
  },
});
