import { gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import {
  dateTimeScalar,
  jsonObjectScalar,
  priceScalar,
} from "@apollo/client/testing/internal";

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

test("leaves a null custom scalar variable unchanged", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime) {
      createEvent(startsAt: $startsAt) {
        id
      }
    }
  `;
  const variables = {
    startsAt: null,
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    startsAt: null,
  });
  expect(result).toBe(variables);
});

test("serializes variables in a document containing fragment definitions", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const query = gql`
    query Event($startsAt: DateTime!) {
      event(startsAt: $startsAt) {
        ...EventFragment
      }
    }

    fragment EventFragment on Event {
      id
      name
    }
  `;

  expect(
    cache.serializeVariables(query, {
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
    })
  ).toStrictEqualTyped({
    startsAt: "2026-01-01T00:00:00.000Z",
  });
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

test("serializes mixed parsed and serialized scalar object list values", () => {
  const cache = new InMemoryCache({
    scalars: {
      JSONObject: jsonObjectScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvents($metadata: [JSONObject!]!) {
      createEvents(metadata: $metadata) {
        id
      }
    }
  `;
  const serializedMetadata = {
    location: "Online",
  };
  const metadata = [
    new Map<string, unknown>([
      ["location", "Denver"],
      ["capacity", 500],
    ]),
    serializedMetadata,
  ];
  const variables = { metadata };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    metadata: [
      {
        location: "Denver",
        capacity: 500,
      },
      serializedMetadata,
    ],
  });
  expect(result).not.toBe(variables);
  expect(result.metadata).not.toBe(metadata);
  expect(result.metadata[1]).toBe(serializedMetadata);
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

test("serializes a scalar object field in a configured input object", () => {
  const cache = new InMemoryCache({
    scalars: {
      JSONObject: jsonObjectScalar,
    },
    inputObjects: {
      EventInput: {
        fields: {
          metadata: "JSONObject",
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
        metadata: new Map<string, unknown>([
          ["location", "Denver"],
          ["capacity", 500],
        ]),
      },
    })
  ).toStrictEqualTyped({
    input: {
      name: "GraphQL Summit",
      metadata: {
        location: "Denver",
        capacity: 500,
      },
    },
  });
});

test("serializes mixed scalar object list fields in a configured input object", () => {
  const cache = new InMemoryCache({
    scalars: {
      JSONObject: jsonObjectScalar,
    },
    inputObjects: {
      EventInput: {
        fields: {
          metadata: "JSONObject",
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
  const serializedMetadata = {
    location: "Online",
  };
  const metadata = [
    new Map<string, unknown>([
      ["location", "Denver"],
      ["capacity", 500],
    ]),
    serializedMetadata,
  ];
  const variables = {
    input: {
      metadata,
    },
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    input: {
      metadata: [
        {
          location: "Denver",
          capacity: 500,
        },
        serializedMetadata,
      ],
    },
  });
  expect(result).not.toBe(variables);
  expect(result.input).not.toBe(variables.input);
  expect(result.input.metadata).not.toBe(metadata);
  expect(result.input.metadata[1]).toBe(serializedMetadata);
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

test("leaves a null configured input object unchanged", () => {
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
    mutation CreateEvent($input: EventInput) {
      createEvent(input: $input) {
        id
      }
    }
  `;
  const variables = {
    input: null,
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    input: null,
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

test("leaves variables unchanged when scalars and input objects are not configured", () => {
  const cache = new InMemoryCache();

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime!, $input: EventInput!) {
      createEvent(startsAt: $startsAt, input: $input) {
        id
      }
    }
  `;
  const startsAt = new Date("2026-01-01T00:00:00.000Z");
  const variables = {
    startsAt,
    input: {
      startsAt,
    },
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    startsAt,
    input: {
      startsAt,
    },
  });
  expect(result).toBe(variables);
});

test("leaves variables unchanged when input objects are configured without their scalars", () => {
  const cache = new InMemoryCache({
    inputObjects: {
      EventInput: {
        fields: {
          startsAt: "DateTime",
        },
      },
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime!, $input: EventInput!) {
      createEvent(startsAt: $startsAt, input: $input) {
        id
      }
    }
  `;
  const startsAt = new Date("2026-01-01T00:00:00.000Z");
  const variables = {
    startsAt,
    input: {
      startsAt,
    },
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    startsAt,
    input: {
      startsAt,
    },
  });
  expect(result).toBe(variables);
});

test("leaves a nested input object unchanged when its configuration is missing", () => {
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
    },
  });

  const query = gql`
    query Events($filter: EventFilter!) {
      events(filter: $filter) {
        id
      }
    }
  `;
  const start = new Date("2026-01-01T00:00:00.000Z");
  const variables = {
    filter: {
      dateRange: {
        start,
      },
    },
  };

  const result = cache.serializeVariables(query, variables);

  expect(result).toStrictEqualTyped({
    filter: {
      dateRange: {
        start,
      },
    },
  });
  expect(result).toBe(variables);
});

test("does not use a nested input object configuration when its parent is not configured", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      DateRangeInput: {
        fields: {
          start: "DateTime",
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
  const start = new Date("2026-01-01T00:00:00.000Z");
  const variables = {
    filter: {
      dateRange: {
        start,
      },
    },
  };

  const result = cache.serializeVariables(query, variables);

  expect(result).toStrictEqualTyped({
    filter: {
      dateRange: {
        start,
      },
    },
  });
  expect(result).toBe(variables);
});

test("leaves configured input objects unchanged when values are already serialized", () => {
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
    query Events($filter: EventFilter!) {
      events(filter: $filter) {
        id
      }
    }
  `;
  const variables = {
    filter: {
      dateRange: {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-01-02T00:00:00.000Z",
      },
    },
  };

  const result = cache.serializeVariables(query, variables);

  expect(result).toStrictEqualTyped({
    filter: {
      dateRange: {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-01-02T00:00:00.000Z",
      },
    },
  });
  expect(result).toBe(variables);
});

test("leaves lists of configured input objects unchanged when values are already serialized", () => {
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
    mutation CreateEvents($inputs: [EventInput!]!) {
      createEvents(inputs: $inputs) {
        id
      }
    }
  `;
  const firstInput = {
    name: "Opening keynote",
    startsAt: "2026-01-01T09:00:00.000Z",
  };
  const secondInput = {
    name: "Closing keynote",
    startsAt: "2026-01-01T17:00:00.000Z",
  };
  const inputs = [firstInput, secondInput];
  const variables = { inputs };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    inputs: [firstInput, secondInput],
  });
  expect(result).toBe(variables);
  expect(result.inputs).toBe(inputs);
  expect(result.inputs[0]).toBe(firstInput);
  expect(result.inputs[1]).toBe(secondInput);
});

test("preserves unchanged references when another input field is serialized", () => {
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
    mutation CreateEvent($input: EventInput!, $context: JSONObject) {
      createEvent(input: $input, context: $context) {
        id
      }
    }
  `;
  const metadata = { source: "import" };
  const tags = ["conference"];
  const context = { requestId: "1" };
  const variables = {
    input: {
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      metadata,
      tags,
    },
    context,
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    input: {
      startsAt: "2026-01-01T00:00:00.000Z",
      metadata,
      tags,
    },
    context,
  });
  expect(result).not.toBe(variables);
  expect(result.input).not.toBe(variables.input);
  expect(result.input.metadata).toBe(metadata);
  expect(result.input.tags).toBe(tags);
  expect(result.context).toBe(context);
});

test("preserves unrelated top-level variable references when another variable is serialized", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime!, $context: JSONObject) {
      createEvent(startsAt: $startsAt, context: $context) {
        id
      }
    }
  `;
  const context = {
    requestId: "1",
  };
  const variables = {
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    context,
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    startsAt: "2026-01-01T00:00:00.000Z",
    context,
  });
  expect(result).not.toBe(variables);
  expect(result.context).toBe(context);
});

test("serializes multiple independent variable branches", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
    inputObjects: {
      EventInput: {
        fields: {
          endsAt: "DateTime",
        },
      },
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime!, $input: EventInput!) {
      createEvent(startsAt: $startsAt, input: $input) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, {
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      input: {
        endsAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    })
  ).toStrictEqualTyped({
    startsAt: "2026-01-01T00:00:00.000Z",
    input: {
      endsAt: "2026-01-02T00:00:00.000Z",
    },
  });
});

test("leaves an empty variables object unchanged", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime) {
      createEvent(startsAt: $startsAt) {
        id
      }
    }
  `;
  const variables = {};

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({});
  expect(result).toBe(variables);
});

test("does not add an omitted variable with a default value", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime = "2026-01-01T00:00:00.000Z") {
      createEvent(startsAt: $startsAt) {
        id
      }
    }
  `;
  const variables = {};

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({});
  expect(result).toBe(variables);
});

test("leaves variables unchanged when the operation has no variable definitions", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const query = gql`
    query Event {
      event {
        id
      }
    }
  `;
  const startsAt = new Date("2026-01-01T00:00:00.000Z");
  const variables = { startsAt };

  const result = cache.serializeVariables(query, variables);

  expect(result).toStrictEqualTyped({ startsAt });
  expect(result).toBe(variables);
});

test("leaves variables not declared by the operation unchanged", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime) {
      createEvent(startsAt: $startsAt) {
        id
      }
    }
  `;
  const context = { requestId: "1" };
  const variables = { context };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({ context });
  expect(result).toBe(variables);
  expect(result.context).toBe(context);
});

test("leaves explicitly undefined scalar and input fields unchanged", () => {
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
    mutation CreateEvent($startsAt: DateTime, $input: EventInput) {
      createEvent(startsAt: $startsAt, input: $input) {
        id
      }
    }
  `;
  const variables = {
    startsAt: undefined,
    input: {
      startsAt: undefined,
    },
  };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({
    startsAt: undefined,
    input: {
      startsAt: undefined,
    },
  });
  expect(result).toBe(variables);
});

test("leaves an empty configured input object unchanged", () => {
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
  const input = {};
  const variables = { input };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({ input: {} });
  expect(result).toBe(variables);
  expect(result.input).toBe(input);
});

test("leaves empty scalar and input object lists unchanged", () => {
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
    mutation CreateEvents($startsAt: [DateTime!]!, $inputs: [EventInput!]!) {
      createEvents(startsAt: $startsAt, inputs: $inputs) {
        id
      }
    }
  `;
  const startsAt: Date[] = [];
  const inputs: Array<{ startsAt: Date }> = [];
  const variables = { startsAt, inputs };

  const result = cache.serializeVariables(mutation, variables);

  expect(result).toStrictEqualTyped({ startsAt: [], inputs: [] });
  expect(result).toBe(variables);
  expect(result.startsAt).toBe(startsAt);
  expect(result.inputs).toBe(inputs);
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
