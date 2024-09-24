export type Prettify<T> = { [K in keyof T]: T[K] } & {};
export type DeepPrettify<T> = {
  [K in keyof T]: T[K] extends object ? Prettify<T[K]> : T[K];
} & {};
