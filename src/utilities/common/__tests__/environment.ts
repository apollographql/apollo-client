import { refreshEnv, isEnv, isDevelopment, isTest } from '../environment';

function setNodeEnv(env: string|undefined) {
  process.env.NODE_ENV = env;
  refreshEnv();
}

describe('environment', () => {
  let keepEnv: string | undefined;

  beforeEach(() => {
    // save the NODE_ENV
    keepEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // restore the NODE_ENV
    setNodeEnv(keepEnv);
  });

  describe('isEnv', () => {
    it(`should match when there's a value`, () => {
      ['production', 'development', 'test'].forEach(env => {
        setNodeEnv(env);
        expect(isEnv(env)).toBe(true);
      });
    });

    it(`should treat no process.env.NODE_ENV as it'd be in development`, () => {
      delete process.env.NODE_ENV;
      refreshEnv();
      expect(isEnv('development')).toBe(true);
    });
  });

  describe('isTest', () => {
    it('should return true if in test', () => {
      setNodeEnv('test');
      expect(isTest()).toBe(true);
    });

    it('should return true if not in test', () => {
      setNodeEnv('development');
      expect(!isTest()).toBe(true);
    });
  });

  describe('isDevelopment', () => {
    it('should return true if in development', () => {
      setNodeEnv('development');
      expect(isDevelopment()).toBe(true);
    });

    it('should return true if not in development and environment is defined', () => {
      setNodeEnv('test');
      expect(!isDevelopment()).toBe(true);
    });

    it('should make development as the default environment', () => {
      delete process.env.NODE_ENV;
      refreshEnv();
      expect(isDevelopment()).toBe(true);
    });
  });
});
