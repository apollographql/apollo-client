import { gql } from "@apollo/client";
import { InMemoryCache, Scalar } from "@apollo/client/cache";

const dateTimeScalar = new Scalar<string, Date>({
  serialize: (value) => value.toISOString(),
  parse: (value) => new Date(value),
});

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

test("parses scalar value when reading a field via cache.readQuery", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        startTime
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startTime: "2026-01-01T00:00:00.000Z",
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("parses scalar value when reading a field via cache.readFragment", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: { scalar: "DateTime" },
        },
      },
    },
  });

  const fragment = gql`
    fragment EventFields on Event {
      id
      startTime
    }
  `;

  cache.writeFragment({
    fragment,
    data: {
      __typename: "Event",
      id: "1",
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(
    cache.readFragment({
      id: cache.identify({ __typename: "Event", id: "1" })!,
      fragment,
    })
  ).toEqual({
    __typename: "Event",
    id: "1",
    startTime: new Date("2026-01-01T00:00:00.000Z"),
  });
});

test("parses each element when the scalar field contains an array of values", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Schedule: {
        fields: {
          meetingTimes: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      schedule {
        meetingTimes
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      schedule: {
        __typename: "Schedule",
        meetingTimes: ["2026-01-01T09:00:00.000Z", "2026-01-02T09:00:00.000Z"],
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    schedule: {
      __typename: "Schedule",
      meetingTimes: [
        new Date("2026-01-01T09:00:00.000Z"),
        new Date("2026-01-02T09:00:00.000Z"),
      ],
    },
  });
});

test("parses each leaf element when the scalar field contains a 2D array", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Schedule: {
        fields: {
          availabilitySlots: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      schedule {
        availabilitySlots
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      schedule: {
        __typename: "Schedule",
        availabilitySlots: [
          ["2026-01-01T09:00:00.000Z", "2026-01-01T10:00:00.000Z"],
          ["2026-01-02T14:00:00.000Z"],
        ],
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    schedule: {
      __typename: "Schedule",
      availabilitySlots: [
        [
          new Date("2026-01-01T09:00:00.000Z"),
          new Date("2026-01-01T10:00:00.000Z"),
        ],
        [new Date("2026-01-02T14:00:00.000Z")],
      ],
    },
  });
});

test("returns null as-is when null is stored in a scalar field position", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          endTime: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        endTime
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        endTime: null,
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      endTime: null,
    },
  });
});

test("parses object-based scalar values (e.g. JSON) when reading from cache", () => {
  const scalar = new Scalar<Record<string, unknown>, Map<string, unknown>>({
    serialize: (value) => Object.fromEntries(value),
    parse: (value) => new Map(Object.entries(value)),
    is: (value) => value instanceof Map,
  });

  const cache = new InMemoryCache({
    scalars: { JSONObject: scalar },
    typePolicies: {
      Product: {
        fields: {
          metadata: { scalar: "JSONObject" },
        },
      },
    },
  });

  const query = gql`
    query {
      product {
        id
        metadata
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      product: {
        __typename: "Product",
        id: "1",
        metadata: { color: "red", size: "large" },
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    product: {
      __typename: "Product",
      id: "1",
      metadata: new Map([
        ["color", "red"],
        ["size", "large"],
      ]),
    },
  });
});

test("parses primitive-to-primitive scalar values when reading from cache", () => {
  const priceScalar = new Scalar<number, string>({
    serialize: (dollars) => Math.round(parseFloat(dollars) * 100),
    parse: (cents) => `${(cents / 100).toFixed(2)}`,
    is: (value) => typeof value === "string",
  });

  const cache = new InMemoryCache({
    scalars: { Price: priceScalar },
    typePolicies: {
      Product: {
        fields: {
          price: { scalar: "Price" },
        },
      },
    },
  });

  const query = gql`
    query {
      product {
        id
        price
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      product: {
        __typename: "Product",
        id: "1",
        price: 1099,
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    product: {
      __typename: "Product",
      id: "1",
      price: "10.99",
    },
  });
});

test("parses scalar fields within each object in an array", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      events {
        id
        startTime
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      events: [
        { __typename: "Event", id: "1", startTime: "2026-01-01T09:00:00.000Z" },
        { __typename: "Event", id: "2", startTime: "2026-01-02T09:00:00.000Z" },
      ],
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    events: [
      {
        __typename: "Event",
        id: "1",
        startTime: new Date("2026-01-01T09:00:00.000Z"),
      },
      {
        __typename: "Event",
        id: "2",
        startTime: new Date("2026-01-02T09:00:00.000Z"),
      },
    ],
  });
});
