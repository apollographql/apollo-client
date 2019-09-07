import { rollup } from '../../config/rollup.config';

export default rollup({
  name: 'apollo-utilities',
  extraGlobals: {
    'fast-json-stable-stringify': 'stringify',
    '@wry/equality': 'wryEquality',
  },
});
