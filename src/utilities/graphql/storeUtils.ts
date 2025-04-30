export interface Reference {
  readonly __ref: string;
}

export function isReference(obj: any): obj is Reference {
  return Boolean(
    obj && typeof obj === "object" && typeof obj.__ref === "string"
  );
}

export type StoreValue =
  | number
  | string
  | string[]
  | Reference
  | Reference[]
  | null
  | undefined
  | void
  | Object;

export interface StoreObject {
  __typename?: string;
  [storeFieldName: string]: StoreValue;
}

/**
 * Workaround for a TypeScript quirk:
 * types per default have an implicit index signature that makes them
 * assignable to `StoreObject`.
 * interfaces do not have that implicit index signature, so they cannot
 * be assigned to `StoreObject`.
 * This type just maps over a type or interface that is passed in,
 * implicitly adding the index signature.
 * That way, the result can be assigned to `StoreObject`.
 *
 * This is important if some user-defined interface is used e.g.
 * in cache.modify, where the `toReference` method expects a
 * `StoreObject` as input.
 */
export type AsStoreObject<T extends { __typename?: string }> = {
  [K in keyof T]: T[K];
};
