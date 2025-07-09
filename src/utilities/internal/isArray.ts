/**
 * A version of Array.isArray that works better with readonly arrays.
 *
 * @internal
 */
export const isArray: (a: any) => a is any[] | readonly any[] = Array.isArray;
