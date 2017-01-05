/**
 * Performs a deep equality check on two JavaScript values.
 */
export function isEqual (a: any, b: any): boolean {
  // If the two values are strictly equal, we are good.
  if (a === b) {
    return true;
  }
  // If a and b are both objects, we will compare their properties. This will compare arrays as
  // well.
  if (a != null && typeof a === 'object' && b != null && typeof b === 'object') {
    // Compare all of the keys in `a`. If one of the keys has a different value, or that key does
    // not exist in `b` return false immediately.
    for (const key in a) {
      if (a.hasOwnProperty(key)) {
        if (!b.hasOwnProperty(key)) {
          return false;
        }
        if (!isEqual(a[key], b[key])) {
          return false;
        }
      }
    }
    // Look through all the keys in `b`. If `b` has a key that `a` does not, return false.
    for (const key in b) {
      if (!a.hasOwnProperty(key)) {
        return false;
      }
    }
    // If we made it this far the objects are equal!
    return true;
  }
  // Otherwise the values are not equal.
  return false;
}
