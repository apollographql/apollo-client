import { InMemoryCache, Scalar } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars
      extends Record<string, { serialized: unknown; parsed: unknown }> {
      DateTime: { serialized: string; parsed: Date };
      RelativeDate: { serialized: string; parsed: string };
    }
  }
}

test("requires only the scalars whose serialized and parsed types differ", () => {
  // @ts-expect-error `scalars` is required.
  new InMemoryCache();

  // @ts-expect-error `DateTime` is missing from `scalars`.
  new InMemoryCache({ scalars: {} });

  new InMemoryCache({
    // @ts-expect-error `DateTime` is missing from `scalars`.
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => value,
        parse: (value) => value,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
      RelativeDate: new Scalar({
        serialize: (value) => value,
        parse: (value) => value,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
      RelativeDate: new Scalar({
        serialize: (value) => value,
        parse: (value) => value,
      }),
      Unknown: new Scalar({
        serialize: (value) => value,
        parse: (value) => value,
      }),
    },
  });
});

test("infers each scalar's serialized and parsed types independently", () => {
  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => {
          expectTypeOf(value).toEqualTypeOf<Date>();
          return value.toISOString();
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return new Date(value);
        },
      }),
      RelativeDate: new Scalar({
        serialize: (value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return value;
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return value;
        },
      }),
      Unknown: new Scalar({
        serialize: (value) => {
          expectTypeOf(value).toEqualTypeOf<unknown>();
          return value;
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<unknown>();
          return value;
        },
      }),
    },
  });
});

test("getScalar resolves each scalar according to its declaration", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
    },
  });

  expectTypeOf(cache.getScalar("DateTime")).toEqualTypeOf<
    Scalar<string, Date>
  >();

  expectTypeOf(cache.getScalar("RelativeDate")).toEqualTypeOf<
    Scalar<string, string> | undefined
  >();

  expectTypeOf(cache.getScalar("Unknown")).toEqualTypeOf<
    Scalar<unknown, unknown> | undefined
  >();
});
