import { ApolloCache, InMemoryCache } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;
declare const maybeDate: string | Date;

declare module "@apollo/client/cache" {
  namespace ApolloCache {
    interface Scalars {
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
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: {
        // @ts-expect-error cannot return undefined
        serialize: (value) => undefined,
        parse: (value) => new Date(value),
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
    },
  });

  new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value) => value.toISOString(),
        // @ts-expect-error cannot return undefined
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

  // @ts-expect-error not a declared scalar
  cache.getScalar("Unknown");
});
