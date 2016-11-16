// import { assert } from 'chai';
import { join } from 'path';

/* tslint:disable */
declare function require(name: string): any;
const rollup: any = require('rollup');
const resolve: any  = require('rollup-plugin-node-resolve');
const commonjs: any  = require('rollup-plugin-commonjs');
/* tslint:enable */

describe('rollup bundle', () => {
  it('can be created', (done) => {
    rollup.rollup({
      entry: join(__dirname, '../../test/bundle/bundleTest.js'),
      onwarn: () => false,
      context: 'global',
      plugins: [ resolve(), commonjs({ include: ['node_modules/**', 'lib/**'] }) ],
    }).then((bundle: any) => {
      return bundle.write({
        // output format - 'amd', 'cjs', 'es', 'iife', 'umd'
        format: 'iife',
        dest: join(__dirname, './bundle/bundleTestOut.js'),
      });
    }).then(() => done())
      .catch(done);
  });
  it('can be evaluated', () => {
    /* tslint:disable */
    require(join(__dirname, './bundle/bundleTestOut.js'));
    /* tslint:enable */
  });
});
