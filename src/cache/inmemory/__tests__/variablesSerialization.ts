import { gql } from "@apollo/client";
import { InMemoryCache, Scalar } from "@apollo/client/cache";

const dateTimeScalar = new Scalar<string, Date>({
  serialize: (value) => value.toISOString(),
  parse: (value) => new Date(value),
});

const priceScalar = new Scalar<number, string>({
  serialize: (value) => Math.round(parseFloat(value) * 100),
  parse: (value) => (value / 100).toFixed(2),
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

test("serializes a custom scalar variable", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime!) {
      createEvent(startsAt: $startsAt) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, {
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
    })
  ).toStrictEqualTyped({ startsAt: "2026-01-01T00:00:00.000Z" });
});

test("leaves an already serialized custom scalar variable unchanged", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime!) {
      createEvent(startsAt: $startsAt) {
        id
      }
    }
  `;

  const variables = {
    startsAt: "2026-01-01T00:00:00.000Z",
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    startsAt: "2026-01-01T00:00:00.000Z",
  });
  expect(result).toBe(variables);
});

test("serializes custom scalar variables whose parsed type is a primitive", () => {
  const cache = new InMemoryCache({
    scalars: {
      Price: priceScalar,
    },
  });

  const mutation = gql`
    mutation PurchaseTicket($price: Price!) {
      purchaseTicket(price: $price) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, { price: "19.99" })
  ).toStrictEqualTyped({
    price: 1999,
  });
});

test("serializes a scalar object variable in parsed or serialized form", () => {
  const cache = new InMemoryCache({
    scalars: {
      JSONObject: jsonObjectScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($metadata: JSONObject!) {
      createEvent(metadata: $metadata) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, {
      metadata: new Map<string, unknown>([
        ["location", "Denver"],
        ["capacity", 500],
      ]),
    })
  ).toStrictEqualTyped({
    metadata: {
      location: "Denver",
      capacity: 500,
    },
  });

  const variables = {
    metadata: {
      location: "Denver",
      capacity: 500,
    },
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    metadata: {
      location: "Denver",
      capacity: 500,
    },
  });
  expect(result).toBe(variables);
});

test("serializes lists and nested lists of custom scalars", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation ScheduleEvents($startsAt: [DateTime], $schedule: [[DateTime!]!]!) {
      scheduleEvents(startsAt: $startsAt, schedule: $schedule) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, {
      startsAt: [new Date("2026-01-01T00:00:00.000Z"), null],
      schedule: [
        [
          new Date("2026-01-02T00:00:00.000Z"),
          new Date("2026-01-03T00:00:00.000Z"),
        ],
      ],
    })
  ).toStrictEqualTyped({
    startsAt: ["2026-01-01T00:00:00.000Z", null],
    schedule: [["2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"]],
  });
});

test("leaves lists and nested lists alone when variables are already serialized", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation ScheduleEvents($startsAt: [DateTime], $schedule: [[DateTime!]!]!) {
      scheduleEvents(startsAt: $startsAt, schedule: $schedule) {
        id
      }
    }
  `;

  const variables = {
    startsAt: ["2026-01-01T00:00:00.000Z", null],
    schedule: [["2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"]],
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    startsAt: ["2026-01-01T00:00:00.000Z", null],
    schedule: [["2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"]],
  });

  expect(result).toBe(variables);
});

test("serializes configured fields in an input object", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
      Price: priceScalar,
    },
    inputObjects: {
      EventInput: {
        fields: {
          startsAt: "DateTime",
          ticketPrice: "Price",
        },
      },
    },
  });

  const mutation = gql`
    mutation CreateEvent($input: EventInput!) {
      createEvent(input: $input) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, {
      input: {
        name: "GraphQL Summit",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        ticketPrice: "19.99",
      },
    })
  ).toStrictEqualTyped({
    input: {
      name: "GraphQL Summit",
      startsAt: "2026-01-01T00:00:00.000Z",
      ticketPrice: 1999,
    },
  });
});

test("serializes nested configured input objects", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      EventFilter: {
        fields: {
          dateRange: "DateRangeInput",
        },
      },
      DateRangeInput: {
        fields: {
          start: "DateTime",
          end: "DateTime",
        },
      },
    },
  });

  const query = gql`
    query Events($filter: EventFilter) {
      events(filter: $filter) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(query, {
      filter: {
        search: "keynote",
        dateRange: {
          start: new Date("2026-01-01T00:00:00.000Z"),
          end: new Date("2026-01-02T00:00:00.000Z"),
        },
      },
    })
  ).toStrictEqualTyped({
    filter: {
      search: "keynote",
      dateRange: {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-01-02T00:00:00.000Z",
      },
    },
  });
});

test("serializes lists of custom scalars in a configured input object", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      AvailabilityInput: {
        fields: {
          dates: "DateTime",
        },
      },
    },
  });

  const mutation = gql`
    mutation SetAvailability($input: AvailabilityInput!) {
      setAvailability(input: $input) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, {
      input: {
        dates: [
          new Date("2026-01-01T00:00:00.000Z"),
          null,
          [new Date("2026-01-02T00:00:00.000Z")],
        ],
      },
    })
  ).toStrictEqualTyped({
    input: {
      dates: ["2026-01-01T00:00:00.000Z", null, ["2026-01-02T00:00:00.000Z"]],
    },
  });
});

test("serializes lists and nested lists of configured input objects", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      ScheduleInput: {
        fields: {
          sessions: "SessionInput",
        },
      },
      SessionInput: {
        fields: {
          startsAt: "DateTime",
        },
      },
    },
  });

  const mutation = gql`
    mutation CreateSchedules($schedules: [[ScheduleInput!]!]!) {
      createSchedules(schedules: $schedules) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, {
      schedules: [
        [
          {
            name: "Day one",
            sessions: [
              {
                title: "Keynote",
                startsAt: new Date("2026-01-01T09:00:00.000Z"),
              },
              null,
            ],
          },
        ],
      ],
    })
  ).toStrictEqualTyped({
    schedules: [
      [
        {
          name: "Day one",
          sessions: [
            {
              title: "Keynote",
              startsAt: "2026-01-01T09:00:00.000Z",
            },
            null,
          ],
        },
      ],
    ],
  });
});

test("serializes recursive input objects", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      EventFilter: {
        fields: {
          startsAt: "DateTime",
          and: "EventFilter",
        },
      },
    },
  });

  const query = gql`
    query Events($filter: EventFilter!) {
      events(filter: $filter) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(query, {
      filter: {
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        and: [
          {
            startsAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      },
    })
  ).toStrictEqualTyped({
    filter: {
      startsAt: "2026-01-01T00:00:00.000Z",
      and: [
        {
          startsAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    },
  });
});

test("preserves null and omitted input object fields", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      EventInput: {
        fields: {
          startsAt: "DateTime",
          endsAt: "DateTime",
        },
      },
    },
  });

  const mutation = gql`
    mutation CreateEvent($input: EventInput, $fallback: DateTime) {
      createEvent(input: $input, fallback: $fallback) {
        id
      }
    }
  `;

  const variables = {
    input: {
      startsAt: null,
    },
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    input: {
      startsAt: null,
    },
  });
  expect(result).toBe(variables);
});

test("leaves built-in scalar fields and unconfigured fields unchanged", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      EventInput: {
        fields: {
          startsAt: "DateTime",
        },
      },
    },
  });

  const mutation = gql`
    mutation CreateEvent(
      $name: String!
      $capacity: Int!
      $published: Boolean!
      $input: EventInput!
    ) {
      createEvent(
        name: $name
        capacity: $capacity
        published: $published
        input: $input
      ) {
        id
      }
    }
  `;
  const metadata = { source: "import" };

  expect(
    cache.serializeVariables(mutation, {
      name: "GraphQL Summit",
      capacity: 500,
      published: true,
      input: {
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        metadata,
      },
    })
  ).toStrictEqualTyped({
    name: "GraphQL Summit",
    capacity: 500,
    published: true,
    input: {
      startsAt: "2026-01-01T00:00:00.000Z",
      metadata,
    },
  });
});

test("leaves an input object unchanged when its type is not configured", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($input: EventInput!) {
      createEvent(input: $input) {
        id
      }
    }
  `;
  const startsAt = new Date("2026-01-01T00:00:00.000Z");

  const variables = {
    input: {
      startsAt,
    },
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    input: {
      startsAt,
    },
  });
  expect(result).toBe(variables);
});

test("does not mutate the provided variables", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      EventInput: {
        fields: {
          startsAt: "DateTime",
        },
      },
    },
  });

  const mutation = gql`
    mutation CreateEvent($input: EventInput!) {
      createEvent(input: $input) {
        id
      }
    }
  `;
  const startsAt = new Date("2026-01-01T00:00:00.000Z");
  const variables = {
    input: {
      name: "GraphQL Summit",
      startsAt,
    },
  };

  cache.serializeVariables(mutation, variables);

  expect(variables).toStrictEqualTyped({
    input: {
      name: "GraphQL Summit",
      startsAt,
    },
  });
  expect(variables.input.startsAt).toBe(startsAt);
});

test("serializes variables for subscriptions", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      EventInput: {
        fields: {
          startsAt: "DateTime",
        },
      },
    },
  });

  const subscription = gql`
    subscription EventCreated($filter: EventInput!) {
      eventCreated(filter: $filter) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(subscription, {
      filter: {
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    })
  ).toStrictEqualTyped({
    filter: {
      startsAt: "2026-01-01T00:00:00.000Z",
    },
  });
});
