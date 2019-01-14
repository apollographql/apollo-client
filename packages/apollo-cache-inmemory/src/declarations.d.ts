declare module 'optimism' {
  export function wrap<T>(
    originalFunction: T,
    options?: OptimisticWrapOptions,
  ): OptimisticWrapperFunction<T>;
}
