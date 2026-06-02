import { ApolloCache, InMemoryCache } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client/cache" {
  namespace ApolloCache {
    interface Scalars {
      RelativeDate: { input: string; output: string };
      JSONObject: { input: unknown; output: unknown };
    }
  }
}

test("does not require the scalars option when every scalar matches", () => {
  new InMemoryCache();
  new InMemoryCache({});
  new InMemoryCache({ scalars: {} });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value,
      },
      JSONObject: {
        serialize: (value) => value,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value,
      },
      JSONObject: {
        serialize: (value) => value,
        parse: (value) => value,
      },
      // @ts-expect-error not a declared scalar
      Unknown: {
        // @ts-expect-error implicit any type
        serialize: (value) => value,
        // @ts-expect-error implicit any type
        parse: (value) => value,
      },
    },
  });
});

test("serialize receives the output type and parse receives the input type", () => {
  new InMemoryCache({
    scalars: {
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
      JSONObject: {
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

test("serialize must return the input type", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: {
        // @ts-expect-error wrong serialized type
        serialize: (value) => value.length,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        // @ts-expect-error cannot return undefined
        serialize: (value) => undefined,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        // @ts-expect-error missing return
        serialize: (value) => {
          value.trim();
        },
        parse: (value) => value,
      },
    },
  });
});

test("parse must return the output type", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        // @ts-expect-error wrong parsed type
        parse: (value) => value.length,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        // @ts-expect-error cannot return undefined
        parse: (value) => undefined,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        // @ts-expect-error missing return
        parse: (value) => {
          value.trim();
        },
      },
    },
  });
});

test("is receives the combined input and output type", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value,
        is: (value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return typeof value === "string";
        },
      },
    },
  });
});

test("devtools.displayValue receives the output type", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value,
        devtools: {
          displayValue: (value) => {
            expectTypeOf(value).toEqualTypeOf<string>();
            return value;
          },
        },
      },
    },
  });
});

test("getScalar returns the resolved scalar or undefined", () => {
  const cache = new InMemoryCache();

  expectTypeOf(cache.getScalar("RelativeDate")).toEqualTypeOf<
    ApolloCache.Scalar<string, string> | undefined
  >();

  expectTypeOf(cache.getScalar("JSONObject")).toEqualTypeOf<
    ApolloCache.Scalar<unknown, unknown> | undefined
  >();

  // @ts-expect-error not a declared scalar
  cache.getScalar("Unknown");
});
