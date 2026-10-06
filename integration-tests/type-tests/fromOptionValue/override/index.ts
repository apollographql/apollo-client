import type { ApolloCache } from "@apollo/client/cache";
import type { HKT, StoreObject, StoreValue } from "@apollo/client/utilities";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;

type StrictFrom<TData extends { __typename: string }> =
  | {
      // the `__typename` has to match the one of the fragment type
      __typename: TData["__typename"];
      // `& {}` forces values to be "defined" so an explicit `undefined`
      // (as well as `null`) is rejected - an index signature alone does not
      // reject explicitly-`undefined` values.
      [key: string]: Exclude<StoreValue, null | undefined> & {};
    }
  | { __ref: string }
  | string
  | null;

interface StrictFromHKT extends HKT {
  arg1: { __typename: string }; // TData
  return: StrictFrom<this["arg1"]>;
}

declare module "@apollo/client" {
  export interface TypeOverrides {
    FromOptionValue: StrictFromHKT;
  }
}

interface ItemFragment {
  __typename: "Item";
  id: string;
  name: string;
}

test("resolves to the overridden type", () => {
  type Result = ApolloCache.FromOptionValue<ItemFragment>;

  expectTypeOf<Result>().toEqualTypeOf<StrictFrom<ItemFragment>>();
});

test("rejects values disallowed by the override", () => {
  type Result = ApolloCache.FromOptionValue<ItemFragment>;

  // @ts-expect-error __typename is required
  const _missingTypename: Result = { id: "1" };
  // @ts-expect-error __typename must match the fragment type
  const _wrongTypename: Result = { __typename: "WrongItem", id: "1" };
  // @ts-expect-error id may not be null
  const _nullValue: Result = { __typename: "Item", id: null };
  // @ts-expect-error id may not be undefined
  const _undefinedValue: Result = { __typename: "Item", id: undefined };

  // identifier values may not be possibly-nullish (asserted at the type level
  // so the check is stable regardless of how the object literal is formatted)
  expectTypeOf<{
    __typename: "Item";
    id: string | undefined;
  }>().not.toMatchTypeOf<Result>();
});

test("accepts values allowed by the override", () => {
  type Result = ApolloCache.FromOptionValue<ItemFragment>;

  const _validObject: Result = { __typename: "Item", id: "1" };
  const _validCustomKey: Result = { __typename: "Item", objectId: "1" };
  const _validRef: Result = { __ref: "Item:1" };
  const _validString: Result = "1";
  const _validNull: Result = null;
});

test("cache.identify is unaffected by the override", () => {
  const _identifyArg: Parameters<ApolloCache["identify"]>[0] =
    {} as StoreObject;
});
