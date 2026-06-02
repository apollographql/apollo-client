import { ApolloCache, InMemoryCache } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars
      extends Record<string, { input: unknown; output: unknown }> {
      DateTime: { input: string; output: Date };
      RelativeDate: { input: string; output: string };
    }
  }
}

test("requires only the scalars whose input and output differ", () => {
  // @ts-expect-error `scalars` is required.
  new InMemoryCache();

  // @ts-expect-error `DateTime` is missing from `scalars`.
  new InMemoryCache({ scalars: {} });

  new InMemoryCache({
    // @ts-expect-error `DateTime` is missing from `scalars`.
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      },
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      },
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      },
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value,
      },
      Unknown: {
        serialize: (value) => value,
        parse: (value) => value,
      },
    },
  });
});

test("infers each scalar's input and output types independently", () => {
  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => {
          expectTypeOf(value).toEqualTypeOf<Date>();
          return value.toISOString();
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return new Date(value);
        },
      },
      RelativeDate: {
        serialize: (value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return value;
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return value;
        },
      },
      Unknown: {
        serialize: (value) => {
          expectTypeOf(value).toEqualTypeOf<unknown>();
          return value;
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<unknown>();
          return value;
        },
      },
    },
  });
});

test("getScalar resolves each scalar according to its declaration", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      },
    },
  });

  expectTypeOf(cache.getScalar("DateTime")).toEqualTypeOf<
    ApolloCache.Scalar<string, Date>
  >();

  expectTypeOf(cache.getScalar("RelativeDate")).toEqualTypeOf<
    ApolloCache.Scalar<string, string> | undefined
  >();

  expectTypeOf(cache.getScalar("Unknown")).toEqualTypeOf<
    ApolloCache.Scalar<unknown, unknown> | undefined
  >();
});
