import { expectTypeOf } from "expect-type";
import type { QueryReference } from "../QueryReference";
import { InternalQueryReference, wrapQueryRef } from "../QueryReference";
import { ApolloClient, ApolloQueryResult, InMemoryCache } from "../../../core";
import { useSimpleCase } from "../../../testing/internal";
import { MockLink } from "../../../testing";

// Used for type tests
declare const queryRef: QueryReference<{ foo: string }>;

test("toPromise returns promise that resolves with the data", async () => {
  const { query, mocks } = useSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });
  const observable = client.watchQuery({ query });
  const internalQueryReference = new InternalQueryReference(observable, {});
  const queryRef = wrapQueryRef(internalQueryReference);

  const result = await queryRef.toPromise();

  expect(result.data).toEqual({ greeting: "Hello" });
});

test("toPromise returns undefined if maxWait is met", async () => {
  const { query } = useSimpleCase();
  const mocks = [
    { request: { query }, result: { data: { greeting: "Hello" } }, delay: 100 },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });
  const observable = client.watchQuery({ query });
  const internalQueryReference = new InternalQueryReference(observable, {});
  const queryRef = wrapQueryRef(internalQueryReference);

  const result = await queryRef.toPromise({ maxWait: 10 });

  expect(result).toBeUndefined();
});

describe.skip("type tests", () => {
  test("toPromise returns correct type depending on presence of maxWait", () => {
    expectTypeOf(queryRef.toPromise()).toMatchTypeOf<
      Promise<ApolloQueryResult<{ foo: string }>>
    >();
    expectTypeOf(queryRef.toPromise({})).toMatchTypeOf<
      Promise<ApolloQueryResult<{ foo: string }>>
    >();
    expectTypeOf(queryRef.toPromise({ maxWait: undefined })).toMatchTypeOf<
      Promise<ApolloQueryResult<{ foo: string }>>
    >();
    expectTypeOf(queryRef.toPromise({ maxWait: 1000 })).toMatchTypeOf<
      Promise<ApolloQueryResult<{ foo: string }> | undefined>
    >();
  });
});
