import { InMemoryCache, Scalar } from "@apollo/client/cache";

test("getScalar returns a scalar object for a configured scalar", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: new Scalar<string, Date>({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
    },
  });

  expect(cache.getScalar("DateTime")).toBeDefined();
});

test("getScalar returns undefined for an unconfigured scalar", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: new Scalar<string, Date>({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
    },
  });

  expect(cache.getScalar("Unconfigured")).toBeUndefined();
});

test("serialize uses the configured serialize function", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: new Scalar<string, Date>({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
    },
  });

  const scalar = cache.getScalar("DateTime")!;

  expect(scalar.serialize(new Date("2026-01-01T00:00:00.000Z"))).toBe(
    "2026-01-01T00:00:00.000Z"
  );
});

test("parse uses the configured parse function", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: new Scalar<string, Date>({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
    },
  });

  const scalar = cache.getScalar("DateTime")!;

  expect(scalar.parse("2026-01-01T00:00:00.000Z")).toEqual(
    new Date("2026-01-01T00:00:00.000Z")
  );
});

test("is defaults to a non-null object check when not configured", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: new Scalar<string, Date>({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
      }),
    },
  });

  const scalar = cache.getScalar("DateTime")!;

  expect(scalar.is(new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
  expect(scalar.is("2026-01-01T00:00:00.000Z")).toBe(false);
});

test("is uses the configured type guard when configured", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: new Scalar<string, Date>({
        serialize: (value) => value.toISOString(),
        parse: (value) => new Date(value),
        is: (value) => value instanceof Date && !Number.isNaN(value.getTime()),
      }),
    },
  });

  const scalar = cache.getScalar("DateTime")!;

  expect(scalar.is(new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
  expect(scalar.is(new Date("invalid"))).toBe(false);
});
