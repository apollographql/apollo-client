import { InMemoryCache, Scalar } from "@apollo/client/cache";
import { expectTypeOf } from "expect-type";

declare function test(name: string, fn: () => void): void;

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars extends Record<string, { serialized: any; parsed: any }> {
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
      JSONObject: new Scalar({
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

test("serialize receives the parsed type and parse receives the serialized type", () => {
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
      JSONObject: new Scalar({
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
          expectTypeOf(value).toEqualTypeOf<any>();
          return value;
        },
        parse: (value) => {
          expectTypeOf(value).toEqualTypeOf<any>();
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
        // @ts-expect-error wrong serialized type
        serialize: (value) => value.length,
        parse: (value) => value,
      }),
      Unknown: new Scalar({
        serialize: (value) => value.length,
        parse: (value) => value,
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
      Unknown: new Scalar({
        serialize: (value) => undefined,
        parse: (value) => value,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        // @ts-expect-error missing return
        serialize: (value) => {
          value.trim();
        },
        parse: (value) => value,
      }),
      Unknown: new Scalar({
        serialize: (value) => {
          String(value);
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
        // @ts-expect-error wrong parsed type
        parse: (value) => value.length,
      }),
      Unknown: new Scalar({
        serialize: (value) => value,
        parse: (value) => String(value),
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => value,
        // @ts-expect-error cannot return undefined
        parse: (value) => undefined,
      }),
      Unknown: new Scalar({
        serialize: (value) => value,
        parse: (value) => undefined,
      }),
    },
  });

  new InMemoryCache({
    scalars: {
      RelativeDate: new Scalar({
        serialize: (value) => value,
        // @ts-expect-error missing return
        parse: (value) => {
          value.trim();
        },
      }),
      Unknown: new Scalar({
        serialize: (value) => value,
        parse: (value) => {
          String(value);
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
          expectTypeOf(value).toEqualTypeOf<string>();
          return typeof value === "string";
        },
      }),
      Unknown: new Scalar({
        serialize: (value) => value,
        parse: (value) => value,
        is: (value) => {
          expectTypeOf(value).toEqualTypeOf<any>();
          return typeof value === "string";
        },
      }),
    },
  });
});

test("getScalar returns the resolved scalar or undefined", () => {
  const cache = new InMemoryCache();

  expectTypeOf(cache.getScalar("RelativeDate")).toEqualTypeOf<
    Scalar<string, string> | undefined
  >();

  expectTypeOf(cache.getScalar("JSONObject")).toEqualTypeOf<
    Scalar<unknown, unknown> | undefined
  >();

  expectTypeOf(cache.getScalar("Unknown")).toEqualTypeOf<
    Scalar<any, any> | undefined
  >();
});
