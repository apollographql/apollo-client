import buildUmdConfig from '../../config/buildUmdConfig';

export default buildUmdConfig('graphqlAnywhereAsync', {
  input: 'lib/graphql-async.js',
  output: {
    file: 'lib/async.js',
    format: 'umd',
  },
});
