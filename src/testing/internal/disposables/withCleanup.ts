/** @internal */
export function withCleanup<T extends object>(
  item: T,
  cleanup: (item: T) => void
): T & Disposable {
  return Object.assign(item, {
    [Symbol.dispose]() {
      cleanup(item);
    },
  });
}
