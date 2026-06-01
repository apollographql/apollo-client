import type { InMemoryCacheConfig } from "@apollo/client/cache";
import { InMemoryCache } from "@apollo/client/cache";

test("getScalar returns a scalar object for a configured scalar", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
      },
    },
  } as InMemoryCacheConfig);

  expect(cache.getScalar("DateTime")).toBeDefined();
});

test("getScalar returns undefined for an unconfigured scalar", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
      },
    },
  } as InMemoryCacheConfig);

  expect(cache.getScalar("Unconfigured")).toBeUndefined();
});

test("serialize uses the configured serialize function", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
      },
    },
  } as InMemoryCacheConfig);

  const scalar = cache.getScalar("DateTime")!;

  expect(scalar.serialize(new Date("2024-01-01T00:00:00.000Z"))).toBe(
    "2024-01-01T00:00:00.000Z"
  );
});

test("parse uses the configured parse function", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
      },
    },
  } as InMemoryCacheConfig);

  const scalar = cache.getScalar("DateTime")!;

  expect(scalar.parse("2024-01-01T00:00:00.000Z")).toEqual(
    new Date("2024-01-01T00:00:00.000Z")
  );
});

test("is defaults to a non-null object check when not configured", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
      },
    },
  } as InMemoryCacheConfig);

  const scalar = cache.getScalar("DateTime")!;

  expect(scalar.is(new Date("2024-01-01T00:00:00.000Z"))).toBe(true);
  expect(scalar.is("2024-01-01T00:00:00.000Z")).toBe(false);
});

test("is uses the configured type guard when configured", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
        is: (value) => value instanceof Date && !Number.isNaN(value.getTime()),
      },
    },
  } as InMemoryCacheConfig);

  const scalar = cache.getScalar("DateTime")!;

  expect(scalar.is(new Date("2024-01-01T00:00:00.000Z"))).toBe(true);
  expect(scalar.is(new Date("invalid"))).toBe(false);
});

test("devtools.displayValue defaults to serialize when not configured", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
      },
    },
  } as InMemoryCacheConfig);

  const scalar = cache.getScalar("DateTime")!;

  expect(
    scalar.devtools.displayValue(new Date("2024-01-01T00:00:00.000Z"))
  ).toBe("2024-01-01T00:00:00.000Z");
});

test("devtools.displayValue uses the configured function when configured", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: {
        serialize: (value: Date) => value.toISOString(),
        parse: (value: string) => new Date(value),
        devtools: {
          displayValue: (value) => `${value.getFullYear()}`,
        },
      },
    },
  } as InMemoryCacheConfig);

  const scalar = cache.getScalar("DateTime")!;

  expect(
    scalar.devtools.displayValue(new Date("2024-06-01T00:00:00.000Z"))
  ).toBe("2024");
});
