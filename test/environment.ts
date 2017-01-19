import { assert } from 'chai';

import { isEnv, isProduction, isDevelopment, isTest } from '../src/util/environment';

describe('environment', () => {
  let keepEnv: string;

  beforeEach(() => {
    // save the NODE_ENV
    keepEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // restore the NODE_ENV
    process.env.NODE_ENV = keepEnv;
  });

  describe('isEnv', () => {
    it(`should match when there's a value`, () => {
      [
        'production',
        'development',
        'test',
      ]
        .forEach(env => {
          process.env.NODE_ENV = env;
          assert.isTrue(isEnv(env));
        });
    });

    it(`should treat no proces.env.NODE_ENV as it'd be in development`, () => {
      delete process.env.NODE_ENV;
      assert.isTrue(isEnv('development'));
    });
  });

  describe('isProduction', () => {
    it('should return true if in production', () => {
      process.env.NODE_ENV = 'production';
      assert.isTrue(isProduction());
    });

    it('should return false if not in production', () => {
      process.env.NODE_ENV = 'test';
      assert.isTrue(!isProduction());
    });
  });

  describe('isTest', () => {
    it('should return true if in test', () => {
      process.env.NODE_ENV = 'test';
      assert.isTrue(isTest());
    });

    it('should return true if not in test', () => {
      process.env.NODE_ENV = 'development';
      assert.isTrue(!isTest());
    });
  });

  describe('isDevelopment', () => {
    it('should return true if in development', () => {
      process.env.NODE_ENV = 'development';
      assert.isTrue(isDevelopment());
    });

    it('should return true if not in development and environment is defined', () => {
      process.env.NODE_ENV = 'test';
      assert.isTrue(!isDevelopment());
    });

    it('should make development as the default environment', () => {
      delete process.env.NODE_ENV;
      assert.isTrue(isDevelopment());
    });
  });
});
