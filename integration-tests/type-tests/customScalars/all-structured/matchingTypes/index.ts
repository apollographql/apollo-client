import { InMemoryCache, Scalar } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars
      extends Record<string, { serialized: string; parsed: string }> {
      RelativeDate: { serialized: string; parsed: string };
      JSONObject: { serialized: unknown; parsed: unknown };
    }
  }
}

test("does not require the scalars option when every scalar matches", () => {
  new InMemoryCache();
  new InMemoryCache({});
  new InMemoryCache({ scalars: {} });

  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => value,
        parse: (value) => value,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
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

  new InMemoryCache({
    // @ts-expect-error JSONObject doesn't match serialized/parsed type
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => value,
        parse: (value) => value,
      }),
      JSONObject: new Scalar({
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

test("a scalar whose types match the index can be configured", () => {
  new InMemoryCache({
    scalars: {
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
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        // @ts-expect-error cannot return undefined
        serialize: (value) => undefined,
        parse: (value) => value,
      }),
    },
  });
});

test("a scalar whose types do not match the index cannot be configured", () => {
  new InMemoryCache({
    // @ts-expect-error `JSONObject`'s `unknown` types are not assignable to the string index.
    scalars: {
      JSONObject: new Scalar({
        serialize: (value: unknown) => value,
        parse: (value: unknown) => value,
      }),
    },
  });
});

test("getScalar resolves each scalar according to its declaration", () => {
  const cache = new InMemoryCache();

  expectTypeOf(cache.getScalar("RelativeDate")).toEqualTypeOf<
    Scalar<string, string> | undefined
  >();

  expectTypeOf(cache.getScalar("JSONObject")).toEqualTypeOf<
    Scalar<unknown, unknown> | undefined
  >();

  expectTypeOf(cache.getScalar("Unknown")).toEqualTypeOf<
    Scalar<string, string> | undefined
  >();
});
