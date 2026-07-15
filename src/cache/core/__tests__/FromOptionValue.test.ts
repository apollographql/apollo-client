import { expectTypeOf } from "expect-type";

import type { CustomHKT } from "@apollo/client";
import type { ApolloCache } from "@apollo/client/cache";
import type { FragmentType } from "@apollo/client/masking";
import type {
  HKT,
  Reference,
  StoreObject,
  StoreValue,
} from "@apollo/client/utilities";
import type { ApplyHKTImplementationWithDefault } from "@apollo/client/utilities/internal";

// We reuse the test-only `CustomHKT` interface (also used by the HKT tests) so
// we can exercise a `CacheIdentifier` override without globally augmenting
// `TypeOverrides` (which would leak the override into every other test file).
declare module "@apollo/client" {
  export interface CustomHKT {
    CacheIdentifier: StrictFromHKT;
  }
}

type StrictFrom =
  | {
      __typename: string;
      // `& {}` forces values to be "defined" so an explicit `undefined`
      // (as well as `null`) is rejected - an index signature alone does not
      // reject explicitly-`undefined` values.
      [key: string]: Exclude<StoreValue, null | undefined> & {};
    }
  | { __ref: string }
  | string
  | null;

interface StrictFromHKT extends HKT {
  arg1: unknown; // TData (unused)
  return: StrictFrom;
}

interface ItemFragment {
  __typename: "Item";
  id: string;
  name: string;
}

it.skip("type tests", () => {
  {
    // Default (no override): the resolved value is the historic union of
    // `StoreObject | Reference | FragmentType<TData> | string`.
    type Result = ApolloCache.FromOptionValue<ItemFragment>;
    expectTypeOf<Result>().toEqualTypeOf<
      StoreObject | Reference | FragmentType<ItemFragment> | string
    >();
  }

  {
    // With a `CacheIdentifier` override applied, the resolved value uses the
    // app-provided strict shape.
    type Result = ApplyHKTImplementationWithDefault<
      CustomHKT,
      "CacheIdentifier",
      { CacheIdentifier: HKT },
      ItemFragment
    >;
    expectTypeOf<Result>().toEqualTypeOf<StrictFrom>();

    // @ts-expect-error __typename is required
    const _missingTypename: Result = { id: "1" };
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
    // valid identifier objects, refs, strings and null are accepted
    const _validObject: Result = { __typename: "Item", id: "1" };
    const _validCustomKey: Result = {
      __typename: "Item",
      objectId: "1",
    };
    const _validRef: Result = { __ref: "Item:1" };
    const _validString: Result = "1";
    const _validNull: Result = null;
    void [
      _missingTypename,
      _nullValue,
      _undefinedValue,
      _validObject,
      _validCustomKey,
      _validRef,
      _validString,
      _validNull,
    ];
  }

  {
    // Regression guard: `cache.identify` / `cache.modify` accept a plain
    // `StoreObject` and are unaffected by the `CacheIdentifier` override.
    const _identifyArg: Parameters<ApolloCache["identify"]>[0] =
      {} as StoreObject;
    void _identifyArg;
  }
});
