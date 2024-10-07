// https://stackoverflow.com/a/50375286/2012454
export type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I
  : never;
