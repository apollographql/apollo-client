import type {
  Prettify,
  Primitive,
  RemoveIndexSignature,
} from "../../utilities/index.js";

export type IsAny<T> = 0 extends 1 & T ? true : false;

export type UnwrapFragmentRefs<TData> =
  true extends IsAny<TData> ? TData
  : TData extends any ?
    // Leave TData alone if it is Record<string, any> and not a specific shape
    string extends keyof TData ? TData
    : // Ensure tagged/branded types are left alone (i.e. type UUID = string & { ... })
    TData extends Primitive ? TData
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
  [TypeName in NonNullable<T["__typename"]>]: Prettify<
    MergeUnions<ExtractByMatchingTypeNames<T, TypeName>>
  >;
}[NonNullable<T["__typename"]>];

/**
```ts
CombineByTypeName<
  | {
      __typename: "Person" | "Animatronic" | "CartoonCharacter";
      id: number;
      name: string;
    }
  | {
      __typename: "Person";
      birthdate: string;
    }
  | {
      __typename: "Animatronic";
      manufacturer: string;
      warrantyEndDate: string;
    }
  | {
      __typename: "CartoonCharacter";
      animator: string;
      voiceActor: string;
    }
>
    =>
{
    id: number;
    name: string;
    __typename: "Person";
    birthdate: string;
} | {
    id: number;
    name: string;
    __typename: "Animatronic";
    manufacturer: string;
    warrantyEndDate: string;
} | {
    id: number;
    name: string;
    __typename: "CartoonCharacter";
    animator: string;
    voiceActor: string;
}
```
 */
type ExtractByMatchingTypeNames<
  Union extends { __typename?: string },
  TypeName extends string,
> = Union extends any ?
  TypeName extends NonNullable<Union["__typename"]> ?
    Omit<Union, "__typename"> & {
      // preserve `?`, which `& { __typename: TypeName }` would not do
      [K in keyof Union as K extends "__typename" ? K : never]: TypeName;
    }
  : never
: never;

type MergeUnions<TUnion> = MergeUnionsAcc<
  TUnion,
  takeOneFromUnion<TUnion>,
  never
>;

type DistributedRequiredExclude<T, U> =
  T extends any ?
    Required<T> extends Required<U> ?
      Required<U> extends Required<T> ?
        never
      : T
    : T
  : T;

type MergeUnionsAcc<TUnion, Curr, Merged> =
  [Curr] extends [never] ? Merged
  : MergeUnionsAcc<
      DistributedRequiredExclude<TUnion, Curr>,
      takeOneFromUnion<DistributedRequiredExclude<TUnion, Curr>>,
      [Merged] extends [never] ? Curr : MergeObjects<Curr, Merged>
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

type MergeObjects<T, U> = Prettify<
  {
    [k in keyof T]: k extends keyof U ?
      [NonNullable<T[k]>, NonNullable<U[k]>] extends (
        [infer TK extends object, infer UK extends object]
      ) ?
        TK extends unknown[] ?
          UK extends unknown[] ?
            | CombineIntersection<TK[number] | UK[number]>[]
            | Extract<T[k] | U[k], undefined | null>
          : T[k]
        : CombineIntersection<TK | UK> | Extract<T[k] | U[k], undefined | null>
      : T[k]
    : T[k];
  } & Pick<U, Exclude<keyof U, keyof T>>
>;

export type RemoveMaskedMarker<T> = Omit<T, "__masked">;
// force distrubution when T is a union with | undefined
export type RemoveFragmentName<T> =
  T extends any ? Omit<T, " $fragmentName"> : T;

type Exact<in out T> = (x: T) => T;
export type ContainsFragmentsRefs<TData, Seen = never> = true extends (
  IsAny<TData>
) ?
  false
: TData extends object ?
  Exact<TData> extends Seen ? false
  : " $fragmentRefs" extends keyof RemoveIndexSignature<TData> ? true
  : ContainsFragmentsRefs<TData[keyof TData], Seen | Exact<TData>>
: false;
