export type IsNeverish<V> =
  [Exclude<V, undefined>] extends [never] ? true : false;
