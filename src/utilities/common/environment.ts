// Functions for checking whether we're in a development, production, or test
// environment. Uses the NODE_ENV environment variable as the source of truth.
// This is cached on startup, because process.env is actually a C function and
// calling it is somewhat expensive (enough to show up prominently in profiler
// results, if not cached.)

let node_env: string = "development";

export function refreshEnv(): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV) {
    node_env = process.env.NODE_ENV;
  } else {
    node_env = "development";
  }
}
refreshEnv();

export function getEnv(): string | undefined {
  return node_env;
}

export function isEnv(env: string): boolean {
  return getEnv() === env;
}

export function isDevelopment(): boolean {
  return node_env==='development';
}

export function isProduction(): boolean {
  return node_env==='production';
}

export function isTest(): boolean {
  return node_env==='test';
}
