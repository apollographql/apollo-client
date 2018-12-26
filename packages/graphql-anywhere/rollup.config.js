import buildUmdConfig from '../../config/buildUmdConfig';
import buildEsmConfig from '../../config/buildEsmConfig';
import pkg from './package.json';

export default [
  buildUmdConfig('graphqlAnywhere'),
  buildUmdConfig('graphqlAnywhereAsync', {
    input: 'lib/graphql-async.js',
    output: {
      file: 'lib/async.js',
    },
  }),
  buildEsmConfig(pkg),
];
