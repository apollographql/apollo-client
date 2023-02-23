// A version of Array.isArray that works better with readonly arrays.
export const isArray: (a: any) => a is any[] | readonly any[] = Array.isArray;

export function isNonEmptyArray<T>(value?: ArrayLike<T>): value is Array<T> {
  return Array.isArray(value) && value.length > 0;
}
