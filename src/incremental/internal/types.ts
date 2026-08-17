import type { ApolloCache } from "@apollo/client/cache";
import type {
  Exact,
  IsAny,
  IsNeverish,
  Prettify,
  Primitive,
} from "@apollo/client/utilities/internal";

type CustomScalarTypes = {
  [K in keyof ApolloCache.Scalars]:
    | ApolloCache.Scalars[K]["serialized"]
    | ApolloCache.Scalars[K]["parsed"];
}[keyof ApolloCache.Scalars];

type ScalarType =
  CustomScalarTypes extends any ?
    true extends IsAny<CustomScalarTypes> ? Primitive
    : unknown extends CustomScalarTypes ? Primitive
    : Primitive | CustomScalarTypes
  : never;

type HasNeverishField<T> =
  true extends { [K in keyof T]: IsNeverish<T[K]> }[keyof T] ? true : false;

export type ContainsNeverishFields<TData, Seen = never> = true extends (
  IsAny<TData>
) ?
  false
: true extends IsScalarType<TData> ? false
: TData extends ReadonlyArray<infer TItem> ?
  true extends IsScalarType<TItem> ?
    false
  : ContainsNeverishFields<TItem, Seen>
: keyof TData extends never ? TData
: TData extends object ?
  string extends keyof TData ? false
  : [Seen] extends [never] ? ContainsNeverishFieldsInObject<TData, Exact<TData>>
  : Exact<TData> extends Seen ? false
  : ContainsNeverishFieldsInObject<TData, Seen | Exact<TData>>
: false;

type ContainsNeverishFieldsInObject<TData, Seen> =
  HasNeverishField<TData> extends true ? true
  : ContainsNeverishFields<TData[keyof TData], Seen>;

type IsScalarType<TData> =
  Exact<TData> extends Exact<Extract<ScalarType, TData>> ? true : false;

export type RemoveNeverishFields<TData> =
  true extends IsAny<TData> ? TData
  : true extends IsScalarType<TData> ? TData
  : TData extends Array<infer TItem> ? Array<RemoveNeverishFields<TItem>>
  : TData extends ReadonlyArray<infer TItem> ?
    ReadonlyArray<RemoveNeverishFields<TItem>>
  : // Leave TData alone if it is Record<string, any> and not a specific shape
  string extends keyof TData ? TData
  : // short-circuit on empty object
  keyof TData extends never ? TData
  : TData extends object ?
    HasNeverishField<TData> extends true ?
      never
    : Prettify<{ [K in keyof TData]: RemoveNeverishFields<TData[K]> }>
  : TData;
