import isEqualLodash from 'lodash.isequal';

/**
 * Performs a deep equality check on two JavaScript values.
 */
export function isEqual(a: any, b: any): boolean {
  return isEqualLodash(a, b);
}
