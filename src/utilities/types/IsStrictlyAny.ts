// If (and only if) T is any, the union 'a' | 'b' is returned here, representing
// both branches of this conditional type. Only UnionForAny<any> produces this
// union type; all other inputs produce the 'b' literal type.
type UnionForAny<T> = T extends never ? 'a' : 'b';

// If that 'A' | 'B' union is then passed to UnionToIntersection, the result
// should be 'A' & 'B', which TypeScript simplifies to the never type, since the
// literal string types 'A' and 'B' are incompatible. More explanation of this
// helper type: https://stackoverflow.com/a/50375286/62076
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends
    ((k: infer I) => void) ? I : never

// Returns true if T is any, or false for any other type.
// From https://stackoverflow.com/a/61625296/128454
export type IsStrictlyAny<T> =
  UnionToIntersection<UnionForAny<T>> extends never ? true : false;
