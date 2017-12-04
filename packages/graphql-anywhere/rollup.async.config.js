import build from '../../rollup.config';

export default build('graphqlAnywhereAsync', {
  input: 'lib/graphql-async.js',
  output: {
    file: 'lib/async.js',
    format: 'umd',
  },
});
