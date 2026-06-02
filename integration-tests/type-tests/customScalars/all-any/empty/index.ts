import { ApolloCache, InMemoryCache } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars extends Record<string, { input: any; output: any }> {}
  }
}

test("does not require the scalars option", () => {
  new InMemoryCache();
  new InMemoryCache({});
  new InMemoryCache({ scalars: {} });

  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value,
        parse: (value) => value,
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

test("serialize receives the output type and parse receives the input type", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => {
          expectTypeOf(value).toEqualTypeOf<any>();
          return value;
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<any>();
          return value;
        },
      },
      Unknown: {
        serialize: (value) => {
          expectTypeOf(value).toEqualTypeOf<any>();
          return value;
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<any>();
          return value;
        },
      },
    },
  });
});

test("serialize accepts any return value", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value.length,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => undefined,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => {
          value.trim();
        },
        parse: (value) => value,
      },
    },
  });
});

test("parse accepts any return value", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => value.length,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
        parse: (value) => undefined,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: {
        serialize: (value) => value,
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
          expectTypeOf(value).toEqualTypeOf<any>();
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
            expectTypeOf(value).toEqualTypeOf<any>();
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
    ApolloCache.Scalar<any, any> | undefined
  >();

  expectTypeOf(cache.getScalar("JSONObject")).toEqualTypeOf<
    ApolloCache.Scalar<any, any> | undefined
  >();

  expectTypeOf(cache.getScalar("Unknown")).toEqualTypeOf<
    ApolloCache.Scalar<any, any> | undefined
  >();
});
