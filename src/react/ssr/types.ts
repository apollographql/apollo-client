export type BatchOptions = {
  /**
   * Debounce timeout in milliseconds for SSR query batching.
   * When provided, the SSR process will wait for the first query to resolve
   * OR the debounce timeout to expire before continuing to the next render cycle.
   *
   * This is useful for optimizing SSR performance by not waiting for all queries
   * to complete, but should be used carefully as it may result in incomplete data
   * if queries have dependencies on each other.
   *
   * @default undefined (wait for all queries to resolve)
   */
  debounce?: number;
};
