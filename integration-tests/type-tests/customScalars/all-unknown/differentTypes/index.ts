import { ApolloCache, InMemoryCache } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;
declare const maybeDate: string | Date;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars
      extends Record<string, { input: unknown; output: unknown }> {
      DateTime: { input: string; output: Date };
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

test("serialize must return the input type", () => {
  new InMemoryCache({
    scalars: {
      DateTime: {
        // @ts-expect-error wrong serialized type
        serialize: (value) => value.getTime(),
        parse: (value) => new Date(value),
      },
      Unknown: {
        serialize: (value) => value,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: {
        // @ts-expect-error cannot return undefined
        serialize: (value) => undefined,
        parse: (value) => new Date(value),
      },
      Unknown: {
        serialize: (value) => undefined,
        parse: (value) => value,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: {
        // @ts-expect-error missing return
        serialize: (value) => {
          value.toISOString();
        },
        parse: (value) => new Date(value),
      },
      Unknown: {
        serialize: (value) => {
          value;
        },
        parse: (value) => value,
      },
    },
  });
});

test("parse must return the output type", () => {
  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        // @ts-expect-error wrong parsed type
        parse: (value) => value,
      },
      Unknown: {
        serialize: (value) => value,
        parse: (value) => String(value),
      },
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        // @ts-expect-error cannot return undefined
        parse: (value) => undefined,
      },
      Unknown: {
        serialize: (value) => value,
        parse: (value) => undefined,
      },
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        // @ts-expect-error missing return
        parse: (value) => {
          new Date(value);
        },
      },
      Unknown: {
        serialize: (value) => value,
        parse: (value) => {
          String(value);
        },
      },
    },
  });
});

test("is narrows to the output type when used as a type guard", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
        is: (value) => {
          expectTypeOf(value).toEqualTypeOf<string | Date>();
          return value instanceof Date;
        },
      },
    },
  });

  const scalar = cache.getScalar("DateTime");

  if (scalar.is(maybeDate)) {
    expectTypeOf(maybeDate).toEqualTypeOf<Date>();
  } else {
    expectTypeOf(maybeDate).toEqualTypeOf<string>();
  }
});

test("devtools.displayValue receives the output type", () => {
  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
        devtools: {
          displayValue: (value) => {
            expectTypeOf(value).toEqualTypeOf<Date>();
            return value.toISOString();
          },
        },
      },
      Unknown: {
        serialize: (value) => value,
        parse: (value) => value,
        devtools: {
          displayValue: (value) => {
            expectTypeOf(value).toEqualTypeOf<unknown>();
            return value;
          },
        },
      },
    },
  });
});

test("InMemoryCache.getScalar returns the resolved scalar for a declared scalar", () => {
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

  expectTypeOf(cache.getScalar("Unknown")).toEqualTypeOf<
    ApolloCache.Scalar<unknown, unknown> | undefined
  >();
});
