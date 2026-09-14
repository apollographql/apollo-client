import type { ApolloCache } from "@apollo/client/cache";
import type { FragmentType } from "@apollo/client/masking";
import type { Reference, StoreObject } from "@apollo/client/utilities";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;

interface ItemFragment {
  __typename: "Item";
  id: string;
  name: string;
}

test("resolves to the default union when no override is declared", () => {
  type Result = ApolloCache.FromOptionValue<ItemFragment>;

  expectTypeOf<Result>().toEqualTypeOf<
    StoreObject | Reference | FragmentType<ItemFragment> | string
  >();
});
