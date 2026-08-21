import { InMemoryCache, Scalar } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars
      extends Record<string, { serialized: unknown; parsed: unknown }> {}
  }
}

test("does not require the scalars option", () => {
  new InMemoryCache();
  new InMemoryCache({});
  new InMemoryCache({ scalars: {} });

  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value,
        parse: (value) => value,
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

test("serialize receives the parsed type and parse receives the serialized type", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => {
          expectTypeOf(value).toEqualTypeOf<unknown>();
          return value;
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<unknown>();
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

test("serialize must return the serialized type", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        // @ts-expect-error value is unknown
        serialize: (value) => value.length,
        parse: (value) => value,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => undefined,
        parse: (value) => value,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => {
          // @ts-expect-error value is unknown
          value.trim();
        },
        parse: (value) => value,
      }),
    },
  });
});

test("parse must return the parsed type", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => value,
        // @ts-expect-error value is unknown
        parse: (value) => value.length,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => value,
        parse: (value) => undefined,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => value,
        parse: (value) => {
          // @ts-expect-error value is unknown
          value.trim();
        },
      }),
    },
  });
});

test("is receives the combined serialized and parsed type", () => {
  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => value,
        parse: (value) => value,
        is: (value) => {
          expectTypeOf(value).toEqualTypeOf<unknown>();
          return typeof value === "string";
        },
      }),
    },
  });
});

test("getScalar returns the resolved scalar or undefined", () => {
  const cache = new InMemoryCache();

  expectTypeOf(cache.getScalar("RelativeDate")).toEqualTypeOf<
    Scalar<unknown, unknown> | undefined
  >();

  expectTypeOf(cache.getScalar("JSONObject")).toEqualTypeOf<
    Scalar<unknown, unknown> | undefined
  >();

  expectTypeOf(cache.getScalar("Unknown")).toEqualTypeOf<
    Scalar<unknown, unknown> | undefined
  >();
});

test("allows any scalar name in field policies", () => {
  new InMemoryCache({
    typePolicies: {
      Event: {
        fields: {
          startDate: {
            scalar: "DateTime",
          },
          metadata: {
            scalar: "JSONObject",
          },
          unknown: {
            scalar: "Unknown",
          },
        },
      },
    },
  });
});
