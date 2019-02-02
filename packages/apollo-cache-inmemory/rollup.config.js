import { rollup } from '../../config/rollup.config';

export default rollup({
  name: 'apollo-cache-inmemory',
  extraGlobals: {
    'graphql/language/printer': 'print',
    optimism: 'optimism',
    'graphql/language/visitor': 'visitor',
  },
});
