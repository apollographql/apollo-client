import { InMemoryCache } from "@apollo/client/cache";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars
      extends Record<string, { input: string; output: string }> {
      DateTime: { input: string; output: Date };
    }
  }
}

// `DateTime` is a required scalar since its input/output types differ, but its
// `Data` output type is not assignable to the interface it extends so there is
// no valid config where the cache can be constructed.
test("a transforming scalar that conflicts with the index cannot be configured", () => {
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
    },
  });
});
