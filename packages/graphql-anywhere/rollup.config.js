import { rollup } from '../../config/rollup.config';

export default [
  ...rollup({ name: 'graphql-anywhere' }),
  ...rollup({
    name: 'graphql-anywhere-async',
    input: 'src/graphql-async.ts',
    outputPrefix: 'async',
  }),
];
