export default {
  entry: 'lib/src/index.js',
  dest: 'lib/bundles/apollo.umd.js',
  format: 'umd',
  moduleName: 'apollo',
  globals: {
    'lodash': '_'
  }
};
