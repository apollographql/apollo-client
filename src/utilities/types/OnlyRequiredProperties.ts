/**
 * Returns a new type that only contains the required properties from `T`
 */
export type OnlyRequiredProperties<T> = {
  [K in keyof T as {} extends Pick<T, K> ? never : K]: T[K];
};
