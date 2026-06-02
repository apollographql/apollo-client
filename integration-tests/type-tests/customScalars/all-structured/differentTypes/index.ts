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

// `DateTime` is a transforming scalar (`input` !== `output`), so it is required
// in `scalars`. But its `Date` output is not assignable to the
// `{ input: string; output: string }` index this `Scalars` interface extends,
// so there is no valid config for it and the cache cannot be constructed.
test("a transforming scalar that conflicts with the index cannot be configured", () => {
  // @ts-expect-error `scalars` is required because `DateTime` transforms.
  new InMemoryCache();

  new InMemoryCache({
    // @ts-expect-error `DateTime`'s `Date` output is not assignable to the string index.
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
      },
    },
  });
});
