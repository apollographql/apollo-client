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

type CombineIntersection<T> =
  | Exclude<T, { __typename?: string }>
  | CombineByTypeName<Extract<T, { __typename?: string }>>;

type CombineByTypeName<T extends { __typename?: string }> = {
  [TypeName in NonNullable<T["__typename"]>]: Extract<
    T,
    { __typename?: TypeName }
  > extends infer SubSelection extends { __typename?: string } ?
    Prettify<CombineWithArrays<SubSelection>>
  : never;
}[NonNullable<T["__typename"]>];

type AllDistributedKeys<T> = T extends any ? keyof T : never;

type CombineWithArrays<T> = UnionToIntersection<
  AllDistributedKeys<T> extends infer AllKeys ?
    AllKeys extends PropertyKey ?
      Extract<T, { [_ in AllKeys]?: any }> extends (
        infer Sub extends { [_ in AllKeys]?: any }
      ) ?
        ArrayValues<Sub[AllKeys]> extends never ?
          {
            [K in keyof Sub as K & AllKeys]: Sub[K];
          }
        : {
            [K in AllKeys]:
              | Array<
                  | CombineWithArrays<NonNullable<ArrayValues<Sub[K]>>>
                  | Extract<ArrayValues<Sub[K]>, null | undefined>
                >
              | Extract<Sub[K], null | undefined>;
          }
      : never
    : never
  : never
>;

type ArrayValues<T> =
  T extends any ?
    T extends Array<infer U> ?
      U
    : never
  : never;

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
