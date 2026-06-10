import { InMemoryCache } from "@apollo/client/cache";

declare function test(name: string, fn: () => void): void;

test("does not require or allow scalar configuration", () => {
  new InMemoryCache();
  new InMemoryCache({});

  new InMemoryCache({
    scalars: {
      // @ts-expect-error: Scalar types must be declared in ApolloCache.Scalars before usage. See https://www.apollographql.com/docs/react/data/typescript#declaring-scalar-types.
      DateTime: { serialize: () => "", parse: () => "" },
    },
  });
});

test("getScalar cannot be called without a declared scalar", () => {
  const cache = new InMemoryCache();

  // @ts-expect-error no scalars are declared
  cache.getScalar("DateTime");
});
