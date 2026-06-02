import { InMemoryCache } from "@apollo/client/cache";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars
      extends Record<string, { input: string; output: string }> {
      DateTime: { input: string; output: Date };
      RelativeDate: { input: string; output: string };
    }
  }
}

// `RelativeDate` matches the `{ input: string; output: string }` index and is
// fine to configure. `DateTime` transforms (`input` !== `output`), so it is
// required, but its `Date` output is not assignable to the index, so it has no
// valid config — the presence of `DateTime` makes the cache unconstructable.
test("a transforming scalar conflicting with the index blocks configuration", () => {
  // @ts-expect-error `scalars` is required because `DateTime` transforms.
  new InMemoryCache();

  new InMemoryCache({
    // @ts-expect-error `DateTime`'s `Date` output is not assignable to the string index.
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
