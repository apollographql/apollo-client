import { gql } from "@apollo/client";
import { InMemoryCache, Scalar } from "@apollo/client/cache";
import {
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

const dateTimeScalar = new Scalar<string, Date>({
  serialize: (value) => value.toISOString(),
  parse: (value) => new Date(value),
});

const priceScalar = new Scalar<number, string>({
  serialize: (dollars) => Math.round(parseFloat(dollars) * 100),
  parse: (cents) => `${(cents / 100).toFixed(2)}`,
  is: (value) => typeof value === "string",
});

const jsonObjectScalar = new Scalar<
  Record<string, unknown>,
  Map<string, unknown>
>({
  serialize: (value) => Object.fromEntries(value),
  parse: (value) => new Map(Object.entries(value)),
  is: (value) => value instanceof Map,
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

test("serializes parsed scalar value when writing via cache.writeQuery", () => {
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
        startTime: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });
});

test("leaves serialized value unchanged when writing via cache.writeQuery", () => {
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

  expect(cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });
});

test("leaves parsed value unchanged when no scalar policy is configured", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
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
        startTime: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("serializes each element when writing an array of parsed scalar values", () => {
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
        meetingTimes: [
          new Date("2026-01-01T09:00:00.000Z"),
          new Date("2026-01-02T09:00:00.000Z"),
        ],
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      schedule: {
        __typename: "Schedule",
        meetingTimes: ["2026-01-01T09:00:00.000Z", "2026-01-02T09:00:00.000Z"],
      },
    },
  });
});

test("serializes each leaf element when writing a 2D array of parsed scalar values", () => {
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
          [
            new Date("2026-01-01T09:00:00.000Z"),
            new Date("2026-01-01T10:00:00.000Z"),
          ],
          [new Date("2026-01-02T14:00:00.000Z")],
        ],
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      schedule: {
        __typename: "Schedule",
        availabilitySlots: [
          ["2026-01-01T09:00:00.000Z", "2026-01-01T10:00:00.000Z"],
          ["2026-01-02T14:00:00.000Z"],
        ],
      },
    },
  });
});

test("stores null as-is when null is written to a scalar field", () => {
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

  expect(cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      endTime: null,
    },
  });
});

test("serializes object-based parsed scalar values when writing", () => {
  const cache = new InMemoryCache({
    scalars: { JSONObject: jsonObjectScalar },
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
        metadata: new Map([
          ["color", "red"],
          ["size", "large"],
        ]),
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", product: { __ref: "Product:1" } },
    "Product:1": {
      __typename: "Product",
      id: "1",
      metadata: { color: "red", size: "large" },
    },
  });
});

test("serializes parsed scalar value when writing via cache.writeFragment", () => {
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
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(cache.extract()).toEqual({
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-01-01T00:00:00.000Z",
    },
    __META: {
      extraRootIds: ["Event:1"],
    },
  });
});

test("serializes parsed scalar value when overwriting an existing field", () => {
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

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startTime: new Date("2026-06-15T14:30:00.000Z"),
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-06-15T14:30:00.000Z",
    },
  });
});

test("serializes parsed scalar value when a merge function is also configured on the field", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: {
            scalar: "DateTime",
            merge: (_, incoming) => incoming,
          },
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
        startTime: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      event: { __ref: "Event:1" },
    },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });
});

test("serializes the parsed value returned by a merge function", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: {
            scalar: "DateTime",
            merge: (_, incoming) => new Date(incoming),
          },
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

  expect(cache.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      event: { __ref: "Event:1" },
    },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });
});

test("serializes each element when writing an array of parsed scalar values with a merge function", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Schedule: {
        fields: {
          meetingTimes: {
            scalar: "DateTime",
            merge: (_, incoming) => incoming,
          },
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
        meetingTimes: [
          new Date("2026-01-01T09:00:00.000Z"),
          new Date("2026-01-02T09:00:00.000Z"),
        ],
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      schedule: {
        __typename: "Schedule",
        meetingTimes: ["2026-01-01T09:00:00.000Z", "2026-01-02T09:00:00.000Z"],
      },
    },
  });
});

test("serializes each leaf element when writing a 2D array of parsed scalar values with a merge function", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Schedule: {
        fields: {
          availabilitySlots: {
            scalar: "DateTime",
            merge: (_, incoming) => incoming,
          },
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
          [
            new Date("2026-01-01T09:00:00.000Z"),
            new Date("2026-01-01T10:00:00.000Z"),
          ],
          [new Date("2026-01-02T14:00:00.000Z")],
        ],
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      schedule: {
        __typename: "Schedule",
        availabilitySlots: [
          ["2026-01-01T09:00:00.000Z", "2026-01-01T10:00:00.000Z"],
          ["2026-01-02T14:00:00.000Z"],
        ],
      },
    },
  });
});

test("serializes parsed scalar values across a complex nested write", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
      Price: priceScalar,
      JSONObject: jsonObjectScalar,
    },
    possibleTypes: {
      Schedulable: ["Session", "Workshop"],
    },
    typePolicies: {
      Conference: {
        fields: {
          startDate: { scalar: "DateTime" },
          endDate: { scalar: "DateTime" },
          ticketPrice: { scalar: "Price" },
        },
      },
      Schedule: {
        fields: {
          timeSlots: { scalar: "DateTime" },
        },
      },
      Speaker: {
        fields: {
          availableTimes: { scalar: "DateTime" },
        },
      },
      Session: {
        fields: {
          startTime: { scalar: "DateTime" },
          metadata: { scalar: "JSONObject" },
        },
      },
      Workshop: {
        fields: {
          startTime: { scalar: "DateTime" },
          metadata: { scalar: "JSONObject" },
        },
      },
    },
  });

  const query = gql`
    query {
      conference {
        id
        name
        startDate
        endDate
        ticketPrice
        schedule {
          timeSlots
        }
        speakers {
          id
          name
          availableTimes
        }
        scheduledItems {
          __typename
          id
          startTime
          metadata
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      conference: {
        __typename: "Conference",
        id: "conf-1",
        name: "GraphQL Summit",
        startDate: new Date("2026-09-15T09:00:00.000Z"),
        endDate: null,
        ticketPrice: "199.00",
        schedule: {
          __typename: "Schedule",
          timeSlots: [
            [
              new Date("2026-09-15T09:00:00.000Z"),
              new Date("2026-09-15T10:00:00.000Z"),
            ],
            [new Date("2026-09-15T14:00:00.000Z")],
          ],
        },
        speakers: [
          {
            __typename: "Speaker",
            id: "speaker-1",
            name: "Alice",
            availableTimes: [
              new Date("2026-09-15T09:00:00.000Z"),
              new Date("2026-09-15T14:00:00.000Z"),
            ],
          },
          {
            __typename: "Speaker",
            id: "speaker-2",
            name: "Bob",
            availableTimes: [new Date("2026-09-15T10:00:00.000Z"), null],
          },
        ],
        scheduledItems: [
          {
            __typename: "Session",
            id: "session-1",
            startTime: new Date("2026-09-15T09:00:00.000Z"),
            metadata: new Map([["dress", "casual"]]),
          },
          {
            __typename: "Workshop",
            id: "workshop-1",
            startTime: new Date("2026-09-15T14:00:00.000Z"),
            metadata: new Map([["venue", "The Workshop Building"]]),
          },
        ],
      },
    },
  });

  expect(cache.extract()).toMatchObject({
    ROOT_QUERY: {
      __typename: "Query",
      conference: { __ref: "Conference:conf-1" },
    },
    "Conference:conf-1": {
      __typename: "Conference",
      id: "conf-1",
      name: "GraphQL Summit",
      startDate: "2026-09-15T09:00:00.000Z",
      endDate: null,
      ticketPrice: 19900,
      schedule: {
        __typename: "Schedule",
        timeSlots: [
          ["2026-09-15T09:00:00.000Z", "2026-09-15T10:00:00.000Z"],
          ["2026-09-15T14:00:00.000Z"],
        ],
      },
    },
    "Speaker:speaker-1": {
      __typename: "Speaker",
      id: "speaker-1",
      name: "Alice",
      availableTimes: ["2026-09-15T09:00:00.000Z", "2026-09-15T14:00:00.000Z"],
    },
    "Speaker:speaker-2": {
      __typename: "Speaker",
      id: "speaker-2",
      name: "Bob",
      availableTimes: ["2026-09-15T10:00:00.000Z", null],
    },
    "Session:session-1": {
      __typename: "Session",
      id: "session-1",
      startTime: "2026-09-15T09:00:00.000Z",
      metadata: { dress: "casual" },
    },
    "Workshop:workshop-1": {
      __typename: "Workshop",
      id: "workshop-1",
      startTime: "2026-09-15T14:00:00.000Z",
      metadata: { venue: "The Workshop Building" },
    },
  });
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

test("parses scalar value when the field has literal arguments", () => {
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
        startTime(timezone: "UTC")
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

test("parses scalar value when the field has arguments with variables", () => {
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
    query ($timezone: String!) {
      event {
        id
        startTime(timezone: $timezone)
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
    variables: { timezone: "UTC" },
  });

  expect(cache.readQuery({ query, variables: { timezone: "UTC" } })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
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
  const cache = new InMemoryCache({
    scalars: { JSONObject: jsonObjectScalar },
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

test("parses multiple scalar fields on the same object", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar, Price: priceScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: { scalar: "DateTime" },
          endTime: { scalar: "DateTime" },
          ticketPrice: { scalar: "Price" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        startTime
        endTime
        ticketPrice
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startTime: "2026-01-01T09:00:00.000Z",
        endTime: "2026-01-01T10:00:00.000Z",
        ticketPrice: 2099,
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T09:00:00.000Z"),
      endTime: new Date("2026-01-01T10:00:00.000Z"),
      ticketPrice: "20.99",
    },
  });
});

test("parses scalar values when the field is selected via a named fragment", () => {
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
        ...EventFields
      }
    }

    fragment EventFields on Event {
      id
      startTime
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

test("parses scalar values when the field is selected via an inline fragment", () => {
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
        ... @defer {
          id
          startTime
        }
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

test("parses scalar values on the matching member types of a union", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: { startTime: { scalar: "DateTime" } },
      },
      Appointment: {
        fields: { startTime: { scalar: "DateTime" } },
      },
    },
  });

  const query = gql`
    query {
      searchResults {
        __typename
        ... on Event {
          id
          startTime
        }
        ... on Appointment {
          id
          startTime
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      searchResults: [
        {
          __typename: "Event",
          id: "1",
          startTime: "2026-01-01T09:00:00.000Z",
        },
        {
          __typename: "Appointment",
          id: "2",
          startTime: "2026-01-02T14:00:00.000Z",
        },
      ],
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    searchResults: [
      {
        __typename: "Event",
        id: "1",
        startTime: new Date("2026-01-01T09:00:00.000Z"),
      },
      {
        __typename: "Appointment",
        id: "2",
        startTime: new Date("2026-01-02T14:00:00.000Z"),
      },
    ],
  });
});

test("parses scalar values when fields are selected through an interface fragment", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    possibleTypes: {
      Schedulable: ["Event", "Appointment"],
    },
    typePolicies: {
      Event: {
        fields: { startTime: { scalar: "DateTime" } },
      },
      Appointment: {
        fields: { startTime: { scalar: "DateTime" } },
      },
    },
  });

  const query = gql`
    query {
      scheduledItems {
        __typename
        ...SchedulableFields
      }
    }

    fragment SchedulableFields on Schedulable {
      id
      startTime
    }
  `;

  cache.writeQuery({
    query,
    data: {
      scheduledItems: [
        {
          __typename: "Event",
          id: "1",
          startTime: "2026-01-01T09:00:00.000Z",
        },
        {
          __typename: "Appointment",
          id: "2",
          startTime: "2026-01-02T14:00:00.000Z",
        },
      ],
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    scheduledItems: [
      {
        __typename: "Event",
        id: "1",
        startTime: new Date("2026-01-01T09:00:00.000Z"),
      },
      {
        __typename: "Appointment",
        id: "2",
        startTime: new Date("2026-01-02T14:00:00.000Z"),
      },
    ],
  });
});

test("returns the raw value unchanged when a scalar field policy names an unregistered scalar", () => {
  using _ = spyOnConsole("warn");

  const cache = new InMemoryCache({
    typePolicies: {
      Event: {
        fields: {
          startTime: {
            scalar: "Identity",
          },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        __typename
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
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(console.warn).not.toHaveBeenCalled();
});

test("parses scalars for fields with aliases", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
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
        __typename
        id
        start: startTime
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        start: "2026-01-01T00:00:00.000Z",
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      start: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("parses scalar values across a complex nested query", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
      Price: priceScalar,
      JSONObject: jsonObjectScalar,
    },
    possibleTypes: {
      Schedulable: ["Session", "Workshop"],
    },
    typePolicies: {
      Conference: {
        fields: {
          startDate: { scalar: "DateTime" },
          endDate: { scalar: "DateTime" },
          ticketPrice: { scalar: "Price" },
        },
      },
      Schedule: {
        fields: {
          timeSlots: { scalar: "DateTime" },
        },
      },
      Speaker: {
        fields: {
          availableTimes: { scalar: "DateTime" },
        },
      },
      Session: {
        fields: {
          startTime: { scalar: "DateTime" },
          metadata: { scalar: "JSONObject" },
        },
      },
      Workshop: {
        fields: {
          startTime: { scalar: "DateTime" },
          metadata: { scalar: "JSONObject" },
        },
      },
      VirtualPresenter: {
        fields: { nextSession: { scalar: "DateTime" } },
      },
      InPersonPresenter: {
        fields: { arrivalTime: { scalar: "DateTime" } },
      },
    },
  });

  const query = gql`
    query {
      conference {
        id
        name
        startDate
        endDate
        ticketPrice
        schedule {
          timeSlots
        }
        ...SpeakerListFields
        scheduledItems {
          __typename
          ...SchedulableFields
        }
        presenters {
          __typename
          ... on VirtualPresenter {
            id
            name
            nextSession
          }
          ... on InPersonPresenter {
            id
            name
            arrivalTime
          }
        }
      }
    }

    fragment SpeakerListFields on Conference {
      speakers {
        id
        name
        availableTimes
      }
    }

    fragment SchedulableFields on Schedulable {
      id
      startTime
      metadata
    }
  `;

  cache.writeQuery({
    query,
    data: {
      conference: {
        __typename: "Conference",
        id: "conf-1",
        name: "GraphQL Summit",
        startDate: "2026-09-15T09:00:00.000Z",
        endDate: null,
        ticketPrice: 19900,
        schedule: {
          __typename: "Schedule",
          timeSlots: [
            ["2026-09-15T09:00:00.000Z", "2026-09-15T10:00:00.000Z"],
            ["2026-09-15T14:00:00.000Z", "2026-09-15T15:00:00.000Z"],
          ],
        },
        speakers: [
          {
            __typename: "Speaker",
            id: "speaker-1",
            name: "Alice",
            availableTimes: [
              "2026-09-15T09:00:00.000Z",
              "2026-09-15T14:00:00.000Z",
            ],
          },
          {
            __typename: "Speaker",
            id: "speaker-2",
            name: "Bob",
            // null is valid in a scalar array
            availableTimes: ["2026-09-15T10:00:00.000Z", null],
          },
        ],
        scheduledItems: [
          {
            __typename: "Session",
            id: "session-1",
            startTime: "2026-09-15T09:00:00.000Z",
            metadata: { dress: "casual" },
          },
          {
            __typename: "Workshop",
            id: "workshop-1",
            startTime: "2026-09-15T14:00:00.000Z",
            metadata: { venue: "The Workshop Building" },
          },
        ],
        presenters: [
          {
            __typename: "VirtualPresenter",
            id: "vp-1",
            name: "Charlie",
            nextSession: "2026-09-15T09:00:00.000Z",
          },
          {
            __typename: "InPersonPresenter",
            id: "ip-1",
            name: "Diana",
            arrivalTime: "2026-09-14T18:00:00.000Z",
          },
        ],
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    conference: {
      __typename: "Conference",
      id: "conf-1",
      name: "GraphQL Summit",
      startDate: new Date("2026-09-15T09:00:00.000Z"),
      endDate: null,
      ticketPrice: "199.00",
      schedule: {
        __typename: "Schedule",
        timeSlots: [
          [
            new Date("2026-09-15T09:00:00.000Z"),
            new Date("2026-09-15T10:00:00.000Z"),
          ],
          [
            new Date("2026-09-15T14:00:00.000Z"),
            new Date("2026-09-15T15:00:00.000Z"),
          ],
        ],
      },
      speakers: [
        {
          __typename: "Speaker",
          id: "speaker-1",
          name: "Alice",
          availableTimes: [
            new Date("2026-09-15T09:00:00.000Z"),
            new Date("2026-09-15T14:00:00.000Z"),
          ],
        },
        {
          __typename: "Speaker",
          id: "speaker-2",
          name: "Bob",
          availableTimes: [new Date("2026-09-15T10:00:00.000Z"), null],
        },
      ],
      scheduledItems: [
        {
          __typename: "Session",
          id: "session-1",
          startTime: new Date("2026-09-15T09:00:00.000Z"),
          metadata: new Map([["dress", "casual"]]),
        },
        {
          __typename: "Workshop",
          id: "workshop-1",
          startTime: new Date("2026-09-15T14:00:00.000Z"),
          metadata: new Map([["venue", "The Workshop Building"]]),
        },
      ],
      presenters: [
        {
          __typename: "VirtualPresenter",
          id: "vp-1",
          name: "Charlie",
          nextSession: new Date("2026-09-15T09:00:00.000Z"),
        },
        {
          __typename: "InPersonPresenter",
          id: "ip-1",
          name: "Diana",
          arrivalTime: new Date("2026-09-14T18:00:00.000Z"),
        },
      ],
    },
  });
});

test("parses scalar values on each emit from cache.watchFragment", async () => {
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
      startTime: "2026-01-01T09:00:00.000Z",
    },
  });

  using stream = new ObservableStream(
    cache.watchFragment({
      fragment,
      from: { __typename: "Event", id: "1" },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T09:00:00.000Z"),
    },
    dataState: "complete",
    complete: true,
  });

  cache.writeFragment({
    fragment,
    data: {
      __typename: "Event",
      id: "1",
      startTime: "2026-06-15T14:30:00.000Z",
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-06-15T14:30:00.000Z"),
    },
    dataState: "complete",
    complete: true,
  });

  cache.writeFragment({
    fragment,
    data: {
      __typename: "Event",
      id: "1",
      startTime: "2026-12-31T23:59:59.000Z",
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-12-31T23:59:59.000Z"),
    },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("ignores scalar and emits a dev warning when a scalar option is set on a field with a selection set", () => {
  using _ = spyOnConsole("warn");

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Query: {
        fields: {
          event: { scalar: "DateTime" },
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
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "The field policy for '%s' is configured as a '%s' scalar, but the field is not a scalar field because it contains a selection set. The field value remains unchanged.",
    "Query.event",
    "DateTime"
  );
});

test("deep merges scalar option with policies.addTypePolices", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
      Price: priceScalar,
      JSONObject: jsonObjectScalar,
    },
    typePolicies: {
      Conference: {
        fields: {
          startDate: { scalar: "DateTime" },
          endDate: { merge: (_, incoming) => incoming },
        },
      },
      Schedule: {
        fields: {
          timeSlots: { scalar: "Price" },
        },
      },
      Speaker: {
        fields: {
          availableTimes: { keyArgs: false },
        },
      },
    },
  });

  cache.policies.addTypePolicies({
    Conference: {
      fields: {
        endDate: { scalar: "DateTime" },
        ticketPrice: { scalar: "Price" },
      },
    },
    Schedule: {
      fields: {
        timeSlots: { scalar: "DateTime" },
      },
    },
    Speaker: {
      fields: {
        availableTimes: { scalar: "DateTime" },
      },
    },
    Session: {
      fields: {
        startTime: { scalar: "DateTime" },
        metadata: { scalar: "JSONObject" },
      },
    },
  });

  const query = gql`
    query {
      conference {
        id
        name
        startDate
        endDate
        ticketPrice
        schedule {
          timeSlots
        }
        speakers {
          id
          name
          availableTimes
        }
        sessions {
          __typename
          id
          startTime
          metadata
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      conference: {
        __typename: "Conference",
        id: "conf-1",
        name: "GraphQL Summit",
        startDate: "2026-09-15T09:00:00.000Z",
        endDate: "2026-09-15T11:00:00.000Z",
        ticketPrice: 19900,
        schedule: {
          __typename: "Schedule",
          timeSlots: [
            ["2026-09-15T09:00:00.000Z", "2026-09-15T10:00:00.000Z"],
            ["2026-09-15T14:00:00.000Z", "2026-09-15T15:00:00.000Z"],
          ],
        },
        speakers: [
          {
            __typename: "Speaker",
            id: "speaker-1",
            name: "Alice",
            availableTimes: [
              "2026-09-15T09:00:00.000Z",
              "2026-09-15T14:00:00.000Z",
            ],
          },
          {
            __typename: "Speaker",
            id: "speaker-2",
            name: "Bob",
            availableTimes: ["2026-09-15T10:00:00.000Z", null],
          },
        ],
        sessions: [
          {
            __typename: "Session",
            id: "session-1",
            startTime: "2026-09-15T09:00:00.000Z",
            metadata: { dress: "casual" },
          },
        ],
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    conference: {
      __typename: "Conference",
      id: "conf-1",
      name: "GraphQL Summit",
      startDate: new Date("2026-09-15T09:00:00.000Z"),
      endDate: new Date("2026-09-15T11:00:00.000Z"),
      ticketPrice: "199.00",
      schedule: {
        __typename: "Schedule",
        timeSlots: [
          [
            new Date("2026-09-15T09:00:00.000Z"),
            new Date("2026-09-15T10:00:00.000Z"),
          ],
          [
            new Date("2026-09-15T14:00:00.000Z"),
            new Date("2026-09-15T15:00:00.000Z"),
          ],
        ],
      },
      speakers: [
        {
          __typename: "Speaker",
          id: "speaker-1",
          name: "Alice",
          availableTimes: [
            new Date("2026-09-15T09:00:00.000Z"),
            new Date("2026-09-15T14:00:00.000Z"),
          ],
        },
        {
          __typename: "Speaker",
          id: "speaker-2",
          name: "Bob",
          availableTimes: [new Date("2026-09-15T10:00:00.000Z"), null],
        },
      ],
      sessions: [
        {
          __typename: "Session",
          id: "session-1",
          startTime: new Date("2026-09-15T09:00:00.000Z"),
          metadata: new Map([["dress", "casual"]]),
        },
      ],
    },
  });
});
