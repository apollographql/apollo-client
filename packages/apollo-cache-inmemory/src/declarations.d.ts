declare module 'optimism' {
  export function wrap<T>(
    originalFunction: T,
    options?: import('./optimism').OptimisticWrapOptions,
  ): import('./optimism').OptimisticWrapperFunction<T>;
}
