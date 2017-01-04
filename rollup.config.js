function globals(mod) {
  if (mod.indexOf('lodash/') === 0) return '_';
}

export default {
  entry: 'lib/src/index.js',
  dest: 'lib/apollo.umd.js',
  format: 'umd',
  sourceMap: true,
  moduleName: 'apollo',
  globals
};
