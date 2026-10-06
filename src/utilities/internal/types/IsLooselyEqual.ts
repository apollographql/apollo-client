/**
 * Compare two types to see if they are loosely equal to each other without
 * checking structural integrity.
 */
export type IsLooselyEqual<A, B> =
  [A] extends [B] ?
    [B] extends [A] ?
      true
    : false
  : false;
