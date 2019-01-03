declare module 'optimism' {
  export function wrap<T>(
    originalFunction: T,
    options?: import('./types').OptimisticWrapOptions,
  ): import('./types').OptimisticWrapperFunction<T>;
}
