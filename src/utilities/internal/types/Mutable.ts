export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};
