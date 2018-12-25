import buildUmdConfig from '../../config/buildUmdConfig';
import buildEsmConfig from '../../config/buildEsmConfig';
import pkg from './package.json';

export default [buildUmdConfig('graphqlAnywhere'), buildEsmConfig(pkg)];
