export type UnwrapFragmentRefs<TData> =
  // Leave TData alone if it is Record<string, any> and not a specific shape
  string extends keyof NonNullable<TData> ? TData
  : TData extends { " $fragmentRefs"?: object | null } ?
    Combine<KeyTuples<TData>> extends infer Flattened ?
      { [K in keyof Flattened]: UnwrapFragmentRefs<Flattened[K]> }
    : never
  : TData extends object ? { [K in keyof TData]: UnwrapFragmentRefs<TData[K]> }
  : TData;

export type RemoveMaskedMarker<T> = Omit<T, "__masked">;

type Values<T> = T extends object ? T[keyof T] : never;

type KeyTuples<V> =
  V extends object ?
    keyof V extends infer K ?
      K extends keyof V ?
        K extends " $fragmentRefs" ? KeyTuples<Values<V[K]>>
        : K extends " $fragmentName" ? never
        : [K, V[K], {} extends Pick<V, K> ? true : false]
      : never
    : never
  : never;

type Combine<
  Tuple extends [key: string | number | symbol, value: any, optional: boolean],
> = {
  [P in Tuple as P[2] extends true ? P[0] : never]?: P[1];
} & {
  [P in Tuple as P[2] extends false ? P[0] : never]: P[1];
};
