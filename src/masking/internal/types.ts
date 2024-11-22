import type { Prettify, UnionToIntersection } from "../../utilities/index.js";

export type IsAny<T> = 0 extends 1 & T ? true : false;

export type UnwrapFragmentRefs<TData> =
  true extends IsAny<TData> ? TData
  : TData extends any ?
    // Leave TData alone if it is Record<string, any> and not a specific shape
    string extends keyof TData ? TData
    : // short-circuit on empty object
    keyof TData extends never ? TData
    : TData extends { " $fragmentRefs"?: infer FragmentRefs } ?
      UnwrapFragmentRefs<
        CombineIntersection<
          | Omit<TData, " $fragmentRefs">
          | RemoveFragmentName<
              NonNullable<
                NonNullable<FragmentRefs>[keyof NonNullable<FragmentRefs>]
              >
            >
        >
      >
    : TData extends Array<infer TItem> ? Array<UnwrapFragmentRefs<TItem>>
    : TData extends object ?
      {
        [K in keyof TData]: UnwrapFragmentRefs<TData[K]>;
      }
    : TData
  : never;

/**
 ```ts
  CombineIntersection<
    | { foo: string }
    | { __typename: "A"; a: string }
    | { __typename: "B"; b1: number }
    | { __typename: "B"; b2: string }
  > =>
    | { foo: string }
    | CombineByTypeName<
      | { __typename: "A"; a: string }
      | { __typename: "B"; b1: number }
      | { __typename: "B"; b2: string }
    >
 ```
 */
type CombineIntersection<T> =
  | Exclude<T, { __typename?: string }>
  | CombineByTypeName<Extract<T, { __typename?: string }>>;
/**
```ts
  CombineByTypeName<
    | { __typename: "A"; a: string }
    | { __typename: "B"; b1: number }
    | { __typename: "B"; b2: string }
  > =>
  | CombineWithArrays<
    | { __typename: "A"; a: string }
  >
  | CombineWithArrays<
    | { __typename: "B"; b1: number }
    | { __typename: "B"; b2: number }
  >
```
 */
type CombineByTypeName<T extends { __typename?: string }> = {
  [TypeName in NonNullable<T["__typename"]>]: Extract<
    T,
    { __typename?: TypeName }
  > extends infer SubSelection ?
    Prettify<MergeUnions<SubSelection>>
  : never;
}[NonNullable<T["__typename"]>];

type MergeUnions<TUnion> = MergeUnionsAcc<TUnion, takeOneFromUnion<TUnion>, {}>;

type MergeUnionsAcc<TUnion, Curr, Merged> =
  [Curr] extends [never] ? Merged
  : MergeUnionsAcc<
      Exclude<TUnion, Curr>,
      takeOneFromUnion<Exclude<TUnion, Curr>>,
      MergeByTypeName<Curr, Merged>
    >;
type unionToIntersection<T> =
  (T extends unknown ? (x: T) => unknown : never) extends (
    (x: infer U) => unknown
  ) ?
    U
  : never;

type takeOneFromUnion<T> =
  unionToIntersection<T extends T ? (x: T) => 0 : never> extends (
    (x: infer U) => 0
  ) ?
    U
  : never;

type MergeByTypeName<T, U> =
  // both have a __typename
  [T, U] extends [{ __typename?: infer TName }, { __typename?: infer UName }] ?
    [TName, UName] extends [UName, TName] ?
      MergeObjects<T, U>
    : T | U
  : // only one has a __typename
  "__typename" extends keyof T | keyof U ? T | U
  : // no __typename
    MergeObjects<T, U>;

type MergeObjects<T, U> = Prettify<
  {
    [k in keyof T]: k extends keyof U ?
      [T[k], U[k]] extends [object, object] ?
        T[k] extends unknown[] ?
          U[k] extends unknown[] ?
            MergeUnions<T[k][number] | U[k][number]>[]
          : T[k]
        : MergeUnions<T[k] | U[k]>
      : T[k]
    : T[k];
  } & Pick<U, Exclude<keyof U, keyof T>>
>;

type UserFieldsFragment = {
  __typename: "User";
  id: number;
  age: number;
} & { " $fragmentName"?: "UserFiedsFragment" };

type NameFieldsFragment = {
  __typename: "User";
  firstName: string;
  lastName: string;
} & { " $fragmentName"?: "NameFieldsFragment" };

type FooF = {
  __typename: "Foo";
  firstName: string;
  lastName: string;
} & { " $fragmentName"?: "NameFieldsFragment" };

type T = MergeUnions<UserFieldsFragment | NameFieldsFragment | FooF>;

export type RemoveMaskedMarker<T> = Omit<T, "__masked">;
// force distrubution when T is a union with | undefined
export type RemoveFragmentName<T> =
  T extends any ? Omit<T, " $fragmentName"> : T;

export type ContainsFragmentsRefs<TData> =
  TData extends object ?
    " $fragmentRefs" extends keyof TData ?
      true
    : ContainsFragmentsRefs<TData[keyof TData]>
  : false;
