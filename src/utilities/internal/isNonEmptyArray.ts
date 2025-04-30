/** @internal */
export function isNonEmptyArray<T>(
  value: ArrayLike<T> | null | undefined
): value is Array<T> {
  return Array.isArray(value) && value.length > 0;
}
