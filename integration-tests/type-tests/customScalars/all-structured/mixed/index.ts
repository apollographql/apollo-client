import { InMemoryCache } from "@apollo/client/cache";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars
      extends Record<string, { serialized: string; parsed: string }> {
      DateTime: { serialized: string; parsed: Date };
      RelativeDate: { serialized: string; parsed: string };
    }
  }
}

// `RelativeDate` matches the `{ serialized: string; parsed: string }` index
// signature and works as expected. `DateTime` however is not assignable to
// index signature it extends, but since it is required, there is no valid
// config where the cache can be constructed.
test("a transforming scalar conflicting with the index blocks configuration", () => {
  // @ts-expect-error `scalars` is required
  new InMemoryCache();
  // @ts-expect-error `scalars` is required
  new InMemoryCache({});
  // @ts-expect-error `DateTime` is missing from `scalars`.
  new InMemoryCache({ scalars: {} });

  new InMemoryCache({
    // @ts-expect-error `DateTime` is not assignable to index signature
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
      },
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value,
      },
    },
  });
});
