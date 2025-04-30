// Matches any primitive value: https://developer.mozilla.org/en-US/docs/Glossary/Primitive.
/** @internal */
export type Primitive =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint;
