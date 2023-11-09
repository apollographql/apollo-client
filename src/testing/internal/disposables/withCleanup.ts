/** @internal */
export function withCleanup<T extends object>(
  item: T,
  cleanup: (item: T) => void
): T & Disposable {
  return {
    ...item,
    [Symbol.dispose]() {
      cleanup(item);
      // if `item` already has a cleanup function, we also need to call the original cleanup function
      // (e.g. if something is wrapped in `withCleanup` twice)
      if (Symbol.dispose in item) {
        (item as Disposable)[Symbol.dispose]();
      }
    },
  };
}
