export function isEnv(env: string): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === env;
}

export function isProduction(): boolean {
  return isEnv('production') === true;
}

export function isDevelopment(): boolean {
  return isEnv('development') === true;
}

export function isTest(): boolean {
  return isEnv('test') === true;
}
