import { InMemoryCache, Scalar } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;
declare const maybeDate: string | Date;

declare module "@apollo/client/cache" {
  namespace ApolloCache {
    interface Scalars {
      DateTime: { serialized: string; parsed: Date };
    }
  }
}

test("requires the scalars option for a declared transforming scalar", () => {
  // @ts-expect-error `scalars` is required.
  new InMemoryCache();

  // @ts-expect-error `scalars` is required.
  new InMemoryCache({});

  // @ts-expect-error `DateTime` is missing from `scalars`.
  new InMemoryCache({ scalars: {} });

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
      // @ts-expect-error not a declared scalar
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
    },
  });
});

test("serialize must return the serialized type", () => {
  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        // @ts-expect-error wrong serialized type
        serialize: (value) => value.getTime(),
        parse: (value) => new Date(value),
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        // @ts-expect-error cannot return undefined
        serialize: (value) => undefined,
        parse: (value) => new Date(value),
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        // @ts-expect-error missing return
        serialize: (value) => {
          value.toISOString();
        },
        parse: (value) => new Date(value),
      }),
    },
  });
});

test("parse must return the parsed type", () => {
  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value.toISOString(),
        // @ts-expect-error wrong parsed type
        parse: (value) => value,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value.toISOString(),
        // @ts-expect-error cannot return undefined
        parse: (value) => undefined,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value.toISOString(),
        // @ts-expect-error missing return
        parse: (value) => {
          new Date(value);
        },
      }),
    },
  });
});

test("is narrows to the parsed type when used as a type guard", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
        is: (value) => {
          expectTypeOf(value).toEqualTypeOf<string | Date>();
          return value instanceof Date;
        },
      }),
    },
  });

  const scalar = cache.getScalar("DateTime");

  if (scalar.is(maybeDate)) {
    expectTypeOf(maybeDate).toEqualTypeOf<Date>();
  } else {
    expectTypeOf(maybeDate).toEqualTypeOf<string>();
  }
});

test("InMemoryCache.getScalar returns the resolved scalar for a declared scalar", () => {
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

  // @ts-expect-error not a declared scalar
  cache.getScalar("Unknown");
});

test("allows only defined scalars field policies", () => {
  new InMemoryCache({
    scalars: {
      DateTime: new Scalar({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
    },
    typePolicies: {
      Event: {
        fields: {
          startDate: {
            scalar: "DateTime",
          },
          metadata: {
            // @ts-expect-error scalar not registered
            scalar: "JSONObject",
          },
        },
      },
    },
  });
});
