export interface Store {
  [dataId: string]: StoreObject;
}

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}

// any is here because it's the only way to express null...
export type StoreValue = number | string | string[] | any;
