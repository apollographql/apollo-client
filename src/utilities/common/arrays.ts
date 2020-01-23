export function isNonEmptyArray<T>(value?: ArrayLike<T>): value is Array<T> {
  return Array.isArray(value) && value.length > 0;
}
