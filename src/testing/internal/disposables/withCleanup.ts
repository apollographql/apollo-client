/** @internal */
export function withCleanup<T extends object>(
  item: T,
  cleanup: (item: T) => void
): T & Disposable {
  return {
    ...item,
    [Symbol.dispose]() {
      cleanup(item);
      if (Symbol.dispose in item) {
        (item as Disposable)[Symbol.dispose]();
      }
    },
  };
}
