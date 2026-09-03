import { GraphQLScalarType, version as graphqlVersion } from "graphql";

import type { TypedDocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";
import { InMemoryCache, Scalar } from "@apollo/client/cache";
import {
  dateTimeRangeScalar,
  dateTimeScalar,
  jsonObjectScalar,
  ObservableStream,
  priceScalar,
  spyOnConsole,
} from "@apollo/client/testing/internal";

const IS_GRAPHQL_17 = graphqlVersion.startsWith("17");

const WARNINGS = {
  SCALAR_FIELD_CONFIG:
    "The field policy for '%s' is configured with the '%s' scalar, so its '%s' function is ignored. Scalar configuration cannot be used with custom read or merge functions.",
  NON_SCALAR_FIELD:
    "The field policy for '%s' is configured with the '%s' scalar, but the field is not a scalar field because it contains a selection set. The field value remains unchanged.",
  LIST_SCALAR_MISMATCH:
    "The custom scalar configuration for '%s' uses list type '%s', but the value is not an array. The value was coerced as '%s' anyway.",
};

test("creates a scalar from a GraphQLScalarType", () => {
  const graphQLScalar = new GraphQLScalarType<Date, string>({
    name: "DateTime",
    serialize: (value) => {
      if (!(value instanceof Date)) {
        throw new TypeError("Expected a Date");
      }

      return value.toISOString();
    },
    parseValue: (value) => {
      if (typeof value !== "string") {
        throw new TypeError("Expected a string");
      }

      return new Date(value);
    },
  });

  const scalar = Scalar.fromGraphQLScalarType(graphQLScalar);

  expect(scalar.parse("2026-01-01T00:00:00.000Z")).toEqual(
    new Date("2026-01-01T00:00:00.000Z")
  );
  expect(scalar.serialize(new Date("2026-01-01T00:00:00.000Z"))).toBe(
    "2026-01-01T00:00:00.000Z"
  );
});

if (IS_GRAPHQL_17) {
  test("creates a scalar from a GraphQLScalarType using GraphQL 17 initializer", () => {
    const graphQLScalar = new GraphQLScalarType<Date, string>({
      name: "DateTime",
      coerceOutputValue: (value) => {
        if (!(value instanceof Date)) {
          throw new TypeError("Expected a Date");
        }

        return value.toISOString();
      },
      coerceInputValue: (value) => {
        if (typeof value !== "string") {
          throw new TypeError("Expected a string");
        }

        return new Date(value);
      },
    });

    const scalar = Scalar.fromGraphQLScalarType(graphQLScalar);

    expect(scalar.parse("2026-01-01T00:00:00.000Z")).toEqual(
      new Date("2026-01-01T00:00:00.000Z")
    );
    expect(scalar.serialize(new Date("2026-01-01T00:00:00.000Z"))).toBe(
      "2026-01-01T00:00:00.000Z"
    );
  });
}

test("uses the configured type guard when coercing values", () => {
  const graphQLScalar = new GraphQLScalarType<number, string>({
    name: "Price",
    serialize: (value) => {
      if (typeof value !== "number") {
        throw new TypeError("Expected a number");
      }

      return value.toFixed(2);
    },
    parseValue: (value) => {
      if (typeof value !== "string") {
        throw new TypeError("Expected a string");
      }

      return Number(value);
    },
  });

  const scalar = Scalar.fromGraphQLScalarType(graphQLScalar, {
    is: (value) => typeof value === "number",
  });

  expect(scalar.coerceToParsed("12.34")).toBe(12.34);
  expect(scalar.coerceToParsed(12.34)).toBe(12.34);
  expect(scalar.coerceToSerialized(12.34)).toBe("12.34");
  expect(scalar.coerceToSerialized("12.34")).toBe("12.34");
});

if (IS_GRAPHQL_17) {
  test("uses the configured type guard with a GraphQL 17 initializer", () => {
    const graphQLScalar = new GraphQLScalarType<number, string>({
      name: "Price",
      coerceOutputValue: (value) => {
        if (typeof value !== "number") {
          throw new TypeError("Expected a number");
        }

        return value.toFixed(2);
      },
      coerceInputValue: (value) => {
        if (typeof value !== "string") {
          throw new TypeError("Expected a string");
        }

        return Number(value);
      },
    });

    const scalar = Scalar.fromGraphQLScalarType(graphQLScalar, {
      is: (value) => typeof value === "number",
    });

    expect(scalar.coerceToParsed("12.34")).toBe(12.34);
    expect(scalar.coerceToParsed(12.34)).toBe(12.34);
    expect(scalar.coerceToSerialized(12.34)).toBe("12.34");
    expect(scalar.coerceToSerialized("12.34")).toBe("12.34");
  });
}

test("preserves errors thrown by the GraphQLScalarType", () => {
  const graphQLScalar = new GraphQLScalarType<Date, string>({
    name: "DateTime",
    serialize: () => {
      throw new TypeError("Unable to serialize DateTime");
    },
    parseValue: () => {
      throw new TypeError("Unable to parse DateTime");
    },
  });

  const scalar = Scalar.fromGraphQLScalarType(graphQLScalar);

  expect(() => scalar.parse("invalid")).toThrow("Unable to parse DateTime");
  expect(() => scalar.serialize(new Date())).toThrow(
    "Unable to serialize DateTime"
  );
});

if (IS_GRAPHQL_17) {
  test("preserves errors thrown by a GraphQL 17 initializer", () => {
    const graphQLScalar = new GraphQLScalarType<Date, string>({
      name: "DateTime",
      coerceOutputValue: () => {
        throw new TypeError("Unable to serialize DateTime");
      },
      coerceInputValue: () => {
        throw new TypeError("Unable to parse DateTime");
      },
    });

    const scalar = Scalar.fromGraphQLScalarType(graphQLScalar);

    expect(() => scalar.parse("invalid")).toThrow("Unable to parse DateTime");
    expect(() => scalar.serialize(new Date())).toThrow(
      "Unable to serialize DateTime"
    );
  });
}

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

test("stores parsed scalar value in the cache when writing via cache.writeQuery", () => {
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("parses serialized scalar value when writing via cache.writeQuery", () => {
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("stores a parsed scalar value on a custom root type when writing via cache.writeQuery", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      RootQuery: {
        queryType: true,
        fields: {
          now: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      now
    }
  `;

  cache.writeQuery({
    query,
    data: {
      now: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "RootQuery",
      now: new Date("2026-01-01T00:00:00.000Z"),
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("stores parsed scalar value in the cache when the field has an alias", () => {
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
        start: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("stores parsed scalar value in the cache when the field has arguments with variables", () => {
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
        startTime: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
    variables: { timezone: "UTC" },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      'startTime({"timezone":"UTC"})': new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("stores parsed scalar value in the cache when the field has arguments with literal value", () => {
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
        startTime: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      'startTime({"timezone":"UTC"})': new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("stores each element as a parsed value when writing an array of scalar values", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Schedule: {
        fields: {
          meetingTimes: { scalar: "[DateTime]" },
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      schedule: {
        __typename: "Schedule",
        meetingTimes: [
          new Date("2026-01-01T09:00:00.000Z"),
          new Date("2026-01-02T09:00:00.000Z"),
        ],
      },
    },
  });
});

test("parses each serialized element when writing an array of scalar values", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Schedule: {
        fields: {
          meetingTimes: { scalar: "[DateTime]" },
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      schedule: {
        __typename: "Schedule",
        meetingTimes: [
          new Date("2026-01-01T09:00:00.000Z"),
          new Date("2026-01-02T09:00:00.000Z"),
        ],
      },
    },
  });
});

test("stores each leaf element as a parsed value when writing a 2D array of scalar values", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Schedule: {
        fields: {
          availabilitySlots: { scalar: "[[DateTime]]" },
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
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
});

test("passes an array-shaped scalar value to parse as a whole when scalar is defined without list syntax", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTimeRange: dateTimeRangeScalar,
    },
    typePolicies: {
      Event: {
        fields: {
          dateRange: { scalar: "DateTimeRange" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        dateRange
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        dateRange: ["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
      },
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      dateRange: {
        start: new Date("2026-01-01T00:00:00.000Z"),
        end: new Date("2026-06-01T00:00:00.000Z"),
      },
    },
  });
});

test("parses each array-shaped scalar when writing a list of array-shaped scalars", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTimeRange: dateTimeRangeScalar,
    },
    typePolicies: {
      Event: {
        fields: {
          dateRanges: { scalar: "[DateTimeRange]" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        dateRanges
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        dateRanges: [
          ["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
          ["2026-07-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"],
        ],
      },
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      dateRanges: [
        {
          start: new Date("2026-01-01T00:00:00.000Z"),
          end: new Date("2026-06-01T00:00:00.000Z"),
        },
        {
          start: new Date("2026-07-01T00:00:00.000Z"),
          end: new Date("2026-12-01T00:00:00.000Z"),
        },
      ],
    },
  });
});

test("passes through a non-array value and warns when a list scalar receives an object", () => {
  using _ = spyOnConsole("warn");

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          dates: { scalar: "[DateTime]" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        dates
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        dates: "2026-01-01T00:00:00.000Z",
      },
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      dates: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.LIST_SCALAR_MISMATCH,
    "Event.dates",
    "[DateTime]",
    "DateTime"
  );
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      endTime: null,
    },
  });
});

test("stores object-based parsed scalar values (e.g. Map) when writing", () => {
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", product: { __ref: "Product:1" } },
    "Product:1": {
      __typename: "Product",
      id: "1",
      metadata: new Map([
        ["color", "red"],
        ["size", "large"],
      ]),
    },
  });
});

test("stores parsed scalar value in the cache when writing via cache.writeFragment", () => {
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

  expect(rawCacheData(cache)).toEqual({
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("stores parsed scalar value in the cache when overwriting an existing field", () => {
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-06-15T14:30:00.000Z"),
    },
  });
});

test("ignores the merge function and stores the parsed scalar value when a merge function is also configured on the field", () => {
  using _ = spyOnConsole("warn");
  const merge = jest.fn((_existing: unknown, incoming: unknown) => incoming);

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: {
            scalar: "DateTime",
            merge,
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

  expect(merge).not.toHaveBeenCalled();
  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      event: { __ref: "Event:1" },
    },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "DateTime",
    "merge"
  );
});

test("stores the parsed incoming value instead of the value returned by an ignored merge function", () => {
  using _ = spyOnConsole("warn");

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: {
            scalar: "DateTime",
            merge: () => new Date("2020-06-15T14:30:00.000Z"),
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      event: { __ref: "Event:1" },
    },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("stores each element as a parsed value when writing an array of scalar values with an ignored merge function", () => {
  using _ = spyOnConsole("warn");
  const merge = jest.fn((_existing: unknown, incoming: unknown) => incoming);

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Schedule: {
        fields: {
          meetingTimes: {
            scalar: "[DateTime]",
            merge,
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

  expect(merge).not.toHaveBeenCalled();
  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      schedule: {
        __typename: "Schedule",
        meetingTimes: [
          new Date("2026-01-01T09:00:00.000Z"),
          new Date("2026-01-02T09:00:00.000Z"),
        ],
      },
    },
  });
});

test("stores each leaf element as a parsed value when writing a 2D array of scalar values with an ignored merge function", () => {
  using _ = spyOnConsole("warn");
  const merge = jest.fn((_existing: unknown, incoming: unknown) => incoming);

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Schedule: {
        fields: {
          availabilitySlots: {
            scalar: "[[DateTime]]",
            merge,
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

  expect(merge).not.toHaveBeenCalled();
  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
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
});

test("stores parsed scalar values across a complex nested write", () => {
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
          timeSlots: { scalar: "[DateTime]" },
        },
      },
      Speaker: {
        fields: {
          availableTimes: { scalar: "[DateTime]" },
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      conference: { __ref: "Conference:conf-1" },
    },
    "Conference:conf-1": {
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
      scheduledItems: [
        { __ref: "Session:session-1" },
        { __ref: "Workshop:workshop-1" },
      ],
      speakers: [
        { __ref: "Speaker:speaker-1" },
        { __ref: "Speaker:speaker-2" },
      ],
    },
    "Speaker:speaker-1": {
      __typename: "Speaker",
      id: "speaker-1",
      name: "Alice",
      availableTimes: [
        new Date("2026-09-15T09:00:00.000Z"),
        new Date("2026-09-15T14:00:00.000Z"),
      ],
    },
    "Speaker:speaker-2": {
      __typename: "Speaker",
      id: "speaker-2",
      name: "Bob",
      availableTimes: [new Date("2026-09-15T10:00:00.000Z"), null],
    },
    "Session:session-1": {
      __typename: "Session",
      id: "session-1",
      startTime: new Date("2026-09-15T09:00:00.000Z"),
      metadata: new Map([["dress", "casual"]]),
    },
    "Workshop:workshop-1": {
      __typename: "Workshop",
      id: "workshop-1",
      startTime: new Date("2026-09-15T14:00:00.000Z"),
      metadata: new Map([["venue", "The Workshop Building"]]),
    },
  });
});

test("stores parsed scalar value in the cache when modifying via cache.modify", () => {
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

  cache.modify({
    id: cache.identify({ __typename: "Event", id: "1" }),
    fields: {
      startTime: () => new Date("2026-06-15T14:30:00.000Z"),
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-06-15T14:30:00.000Z"),
    },
  });
});

test("parses serialized scalar value when modifying via cache.modify", () => {
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

  cache.modify({
    id: cache.identify({ __typename: "Event", id: "1" }),
    fields: {
      startTime: () => "2026-06-15T14:30:00.000Z",
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-06-15T14:30:00.000Z"),
    },
  });
});

test("cache.modify preserves referential identity for deeply equal parsed scalar values", () => {
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

  const existingStartTime = rawCacheData(cache)["Event:1"]!.startTime;

  cache.modify({
    id: cache.identify({ __typename: "Event", id: "1" }),
    fields: {
      startTime: () => "2026-01-01T00:00:00.000Z",
    },
  });

  expect(rawCacheData(cache)["Event:1"]!.startTime).toBe(existingStartTime);

  cache.modify({
    id: cache.identify({ __typename: "Event", id: "1" }),
    fields: {
      startTime: () => new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(rawCacheData(cache)["Event:1"]!.startTime).toBe(existingStartTime);
});

test("cache.modify preserves references when scalar values are already parsed", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        keyFields: false,
        fields: {
          startTime: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        name
        startTime
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        name: "Opening keynote",
        startTime: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  });

  const replacementEvent = {
    __typename: "Event",
    name: "Closing keynote",
    startTime: new Date("2026-01-01T00:00:00.000Z"),
  };

  cache.modify({
    id: "ROOT_QUERY",
    fields: {
      event: () => replacementEvent,
    },
  });

  const modifiedEvent = rawCacheData(cache).ROOT_QUERY!.event;

  expect(modifiedEvent).toBe(replacementEvent);
  expect((modifiedEvent as any).startTime).toBe(replacementEvent.startTime);
});

test("leaves parsed value unchanged when modifying via cache.modify with no scalar policy configured", () => {
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
        startTime: "2026-01-01T00:00:00.000Z",
      },
    },
  });

  cache.modify({
    id: cache.identify({ __typename: "Event", id: "1" }),
    fields: {
      startTime: () => new Date("2026-06-15T14:30:00.000Z"),
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-06-15T14:30:00.000Z"),
    },
  });
});

test("parses a scalar field on an implicit root type when modifying via cache.modify", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Query: {
        fields: {
          now: { scalar: "DateTime" },
        },
      },
    },
  });

  cache.restore({
    ROOT_QUERY: {
      now: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  cache.modify({
    id: "ROOT_QUERY",
    fields: {
      now: () => "2026-06-15T14:30:00.000Z",
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      now: new Date("2026-06-15T14:30:00.000Z"),
    },
  });
});

test("stores each element as a parsed value when modifying an array of scalar values via cache.modify", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Speaker: {
        fields: {
          availableTimes: { scalar: "[DateTime]" },
        },
      },
    },
  });

  const query = gql`
    query {
      speaker {
        id
        availableTimes
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      speaker: {
        __typename: "Speaker",
        id: "1",
        availableTimes: ["2026-01-01T09:00:00.000Z"],
      },
    },
  });

  cache.modify({
    id: cache.identify({ __typename: "Speaker", id: "1" }),
    fields: {
      availableTimes: () => [
        new Date("2026-01-01T09:00:00.000Z"),
        new Date("2026-01-02T09:00:00.000Z"),
      ],
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", speaker: { __ref: "Speaker:1" } },
    "Speaker:1": {
      __typename: "Speaker",
      id: "1",
      availableTimes: [
        new Date("2026-01-01T09:00:00.000Z"),
        new Date("2026-01-02T09:00:00.000Z"),
      ],
    },
  });
});

test("stores each leaf element as a parsed value when modifying a 2D array of scalar values via cache.modify", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Speaker: {
        fields: {
          availabilitySlots: { scalar: "[[DateTime]]" },
        },
      },
    },
  });

  const query = gql`
    query {
      speaker {
        id
        availabilitySlots
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      speaker: {
        __typename: "Speaker",
        id: "1",
        availabilitySlots: [["2026-01-01T09:00:00.000Z"]],
      },
    },
  });

  cache.modify({
    id: cache.identify({ __typename: "Speaker", id: "1" }),
    fields: {
      availabilitySlots: () => [
        [
          new Date("2026-01-01T09:00:00.000Z"),
          new Date("2026-01-01T10:00:00.000Z"),
        ],
        [new Date("2026-01-02T14:00:00.000Z")],
      ],
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", speaker: { __ref: "Speaker:1" } },
    "Speaker:1": {
      __typename: "Speaker",
      id: "1",
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

test("stores null as-is when null is returned by a modifier for a scalar field", () => {
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
        endTime: "2026-01-01T00:00:00.000Z",
      },
    },
  });

  cache.modify({
    id: cache.identify({ __typename: "Event", id: "1" }),
    fields: {
      endTime: () => null,
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      endTime: null,
    },
  });
});

test("deletes a scalar field when returning DELETE from cache.modify", () => {
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

  cache.modify({
    id: cache.identify({ __typename: "Event", id: "1" }),
    fields: {
      startTime: (_, { DELETE }) => DELETE,
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
    },
  });
});

test("stores object-based parsed scalar values when modifying via cache.modify", () => {
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

  cache.modify({
    id: cache.identify({ __typename: "Product", id: "1" }),
    fields: {
      metadata: () =>
        new Map([
          ["color", "blue"],
          ["size", "medium"],
        ]),
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", product: { __ref: "Product:1" } },
    "Product:1": {
      __typename: "Product",
      id: "1",
      metadata: new Map([
        ["color", "blue"],
        ["size", "medium"],
      ]),
    },
  });
});

test("cache.extract() serializes all stored parsed scalar values", () => {
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
          meetingTimes: { scalar: "[DateTime]" },
          availabilitySlots: { scalar: "[[DateTime]]" },
        },
      },
      Speaker: {
        fields: {
          availableTimes: { scalar: "[DateTime]" },
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
    query ($timezone: String) {
      conference {
        id
        name
        startDate
        endDate
        ticketPrice
        schedule {
          meetingTimes
          availabilitySlots
        }
        speakers {
          id
          name
          availableTimes(timezone: "UTC")
        }
        scheduledItems {
          __typename
          id
          startTime(timezone: $timezone)
          metadata
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    variables: { timezone: "UTC" },
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
          meetingTimes: [
            new Date("2026-09-15T09:00:00.000Z"),
            new Date("2026-09-15T14:00:00.000Z"),
          ],
          availabilitySlots: [
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

  expect(cache.extract()).toEqual({
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
        meetingTimes: ["2026-09-15T09:00:00.000Z", "2026-09-15T14:00:00.000Z"],
        availabilitySlots: [
          ["2026-09-15T09:00:00.000Z", "2026-09-15T10:00:00.000Z"],
          ["2026-09-15T14:00:00.000Z"],
        ],
      },
      scheduledItems: [
        { __ref: "Session:session-1" },
        { __ref: "Workshop:workshop-1" },
      ],
      speakers: [
        { __ref: "Speaker:speaker-1" },
        { __ref: "Speaker:speaker-2" },
      ],
    },
    "Speaker:speaker-1": {
      __typename: "Speaker",
      id: "speaker-1",
      name: "Alice",
      'availableTimes({"timezone":"UTC"})': [
        "2026-09-15T09:00:00.000Z",
        "2026-09-15T14:00:00.000Z",
      ],
    },
    "Speaker:speaker-2": {
      __typename: "Speaker",
      id: "speaker-2",
      name: "Bob",
      'availableTimes({"timezone":"UTC"})': ["2026-09-15T10:00:00.000Z", null],
    },
    "Session:session-1": {
      __typename: "Session",
      id: "session-1",
      'startTime({"timezone":"UTC"})': "2026-09-15T09:00:00.000Z",
      metadata: { dress: "casual" },
    },
    "Workshop:workshop-1": {
      __typename: "Workshop",
      id: "workshop-1",
      'startTime({"timezone":"UTC"})': "2026-09-15T14:00:00.000Z",
      metadata: { venue: "The Workshop Building" },
    },
  });
});

test("cache.extract() serializes an array-shaped scalar value as a whole", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTimeRange: dateTimeRangeScalar,
    },
    typePolicies: {
      Event: {
        fields: {
          dateRange: { scalar: "DateTimeRange" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        dateRange
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        dateRange: {
          start: new Date("2026-01-01T00:00:00.000Z"),
          end: new Date("2026-06-01T00:00:00.000Z"),
        },
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      dateRange: ["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
    },
  });
});

test("cache.extract() serializes each array-shaped scalar in a list as a whole", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTimeRange: dateTimeRangeScalar,
    },
    typePolicies: {
      Event: {
        fields: {
          dateRanges: { scalar: "[DateTimeRange]" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        dateRanges
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        dateRanges: [
          {
            start: new Date("2026-01-01T00:00:00.000Z"),
            end: new Date("2026-06-01T00:00:00.000Z"),
          },
          {
            start: new Date("2026-07-01T00:00:00.000Z"),
            end: new Date("2026-12-01T00:00:00.000Z"),
          },
        ],
      },
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      dateRanges: [
        ["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
        ["2026-07-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"],
      ],
    },
  });
});

test("cache.restore() parses all serialized scalar values before storing them", () => {
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
          meetingTimes: { scalar: "[DateTime]" },
          availabilitySlots: { scalar: "[[DateTime]]" },
        },
      },
      Speaker: {
        fields: {
          availableTimes: { scalar: "[DateTime]" },
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

  cache.restore({
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
        meetingTimes: ["2026-09-15T09:00:00.000Z", "2026-09-15T14:00:00.000Z"],
        availabilitySlots: [
          ["2026-09-15T09:00:00.000Z", "2026-09-15T10:00:00.000Z"],
          ["2026-09-15T14:00:00.000Z"],
        ],
      },
      scheduledItems: [
        { __ref: "Session:session-1" },
        { __ref: "Workshop:workshop-1" },
      ],
      speakers: [
        { __ref: "Speaker:speaker-1" },
        { __ref: "Speaker:speaker-2" },
      ],
    },
    "Speaker:speaker-1": {
      __typename: "Speaker",
      id: "speaker-1",
      name: "Alice",
      'availableTimes({"timezone":"UTC"})': [
        "2026-09-15T09:00:00.000Z",
        "2026-09-15T14:00:00.000Z",
      ],
    },
    "Speaker:speaker-2": {
      __typename: "Speaker",
      id: "speaker-2",
      name: "Bob",
      'availableTimes({"timezone":"UTC"})': ["2026-09-15T10:00:00.000Z", null],
    },
    "Session:session-1": {
      __typename: "Session",
      id: "session-1",
      'startTime({"timezone":"UTC"})': "2026-09-15T09:00:00.000Z",
      metadata: { dress: "casual" },
    },
    "Workshop:workshop-1": {
      __typename: "Workshop",
      id: "workshop-1",
      'startTime({"timezone":"UTC"})': "2026-09-15T14:00:00.000Z",
      metadata: { venue: "The Workshop Building" },
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      conference: { __ref: "Conference:conf-1" },
    },
    "Conference:conf-1": {
      __typename: "Conference",
      id: "conf-1",
      name: "GraphQL Summit",
      startDate: new Date("2026-09-15T09:00:00.000Z"),
      endDate: null,
      ticketPrice: "199.00",
      schedule: {
        __typename: "Schedule",
        meetingTimes: [
          new Date("2026-09-15T09:00:00.000Z"),
          new Date("2026-09-15T14:00:00.000Z"),
        ],
        availabilitySlots: [
          [
            new Date("2026-09-15T09:00:00.000Z"),
            new Date("2026-09-15T10:00:00.000Z"),
          ],
          [new Date("2026-09-15T14:00:00.000Z")],
        ],
      },
      scheduledItems: [
        { __ref: "Session:session-1" },
        { __ref: "Workshop:workshop-1" },
      ],
      speakers: [
        { __ref: "Speaker:speaker-1" },
        { __ref: "Speaker:speaker-2" },
      ],
    },
    "Speaker:speaker-1": {
      __typename: "Speaker",
      id: "speaker-1",
      name: "Alice",
      'availableTimes({"timezone":"UTC"})': [
        new Date("2026-09-15T09:00:00.000Z"),
        new Date("2026-09-15T14:00:00.000Z"),
      ],
    },
    "Speaker:speaker-2": {
      __typename: "Speaker",
      id: "speaker-2",
      name: "Bob",
      'availableTimes({"timezone":"UTC"})': [
        new Date("2026-09-15T10:00:00.000Z"),
        null,
      ],
    },
    "Session:session-1": {
      __typename: "Session",
      id: "session-1",
      'startTime({"timezone":"UTC"})': new Date("2026-09-15T09:00:00.000Z"),
      metadata: new Map([["dress", "casual"]]),
    },
    "Workshop:workshop-1": {
      __typename: "Workshop",
      id: "workshop-1",
      'startTime({"timezone":"UTC"})': new Date("2026-09-15T14:00:00.000Z"),
      metadata: new Map([["venue", "The Workshop Building"]]),
    },
  });
});

test("cache.restore() preserves references when scalar values are already parsed", () => {
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

  const event = {
    __typename: "Event",
    id: "1",
    startTime: new Date("2026-01-01T00:00:00.000Z"),
  };

  cache.restore({
    "Event:1": event,
  });

  const restoredEvent = rawCacheData(cache)["Event:1"];

  expect(restoredEvent).toBe(event);
  expect(restoredEvent!.startTime).toBe(event.startTime);
});

test("cache.restore() leaves values as-is when no scalar policy is configured for the field", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
  });

  cache.restore({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });
});

test("cache.restore() parses scalar fields on root objects with an implicit typename", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Query: {
        fields: {
          now: { scalar: "DateTime" },
        },
      },
    },
  });

  cache.restore({
    ROOT_QUERY: {
      now: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      now: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("cache.restore() parses scalar fields on a custom root type with an implicit typename", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      RootQuery: {
        queryType: true,
        fields: {
          now: { scalar: "DateTime" },
        },
      },
    },
  });

  cache.restore({
    ROOT_QUERY: {
      now: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      now: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("cache.restore() parses scalar fields in arrays of non-normalized objects", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        keyFields: false,
        fields: {
          startTime: { scalar: "DateTime" },
        },
      },
    },
  });

  cache.restore({
    ROOT_QUERY: {
      __typename: "Query",
      events: [
        {
          __typename: "Event",
          startTime: "2026-01-01T00:00:00.000Z",
        },
        {
          __typename: "Event",
          startTime: "2026-02-01T00:00:00.000Z",
        },
      ],
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      events: [
        {
          __typename: "Event",
          startTime: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          __typename: "Event",
          startTime: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
    },
  });
});

test("cache.extract() returns the parsed value as-is when no scalar policy is configured for the field", () => {
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

test("cache.extract() serializes scalar fields on root objects with an implicit typename", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Query: {
        fields: {
          now: { scalar: "DateTime" },
        },
      },
    },
  });

  cache.restore({
    ROOT_QUERY: {
      now: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: {
      now: "2026-01-01T00:00:00.000Z",
    },
  });
});

test("cache.extract() serializes scalar fields on a custom root type with an implicit typename", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      RootQuery: {
        queryType: true,
        fields: {
          now: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      now
    }
  `;

  cache.writeQuery({
    query,
    data: {
      now: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "RootQuery",
      now: "2026-01-01T00:00:00.000Z",
    },
  });
});

test("cache.extract() serializes scalar fields in arrays of non-normalized objects written with cache.writeQuery", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        keyFields: false,
        fields: {
          startTime: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      events {
        startTime
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      events: [
        {
          __typename: "Event",
          startTime: "2026-01-01T00:00:00.000Z",
        },
        {
          __typename: "Event",
          startTime: "2026-02-01T00:00:00.000Z",
        },
      ],
    },
  });

  expect(cache.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      events: [
        {
          __typename: "Event",
          startTime: "2026-01-01T00:00:00.000Z",
        },
        {
          __typename: "Event",
          startTime: "2026-02-01T00:00:00.000Z",
        },
      ],
    },
  });
});

test("cache.extract() serializes scalar fields in arrays of non-normalized objects written with cache.writeFragment", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        keyFields: false,
        fields: {
          startTime: { scalar: "DateTime" },
        },
      },
    },
  });

  const fragment = gql`
    fragment ScheduleFields on Schedule {
      id
      events {
        startTime
      }
    }
  `;

  cache.writeFragment({
    fragment,
    data: {
      __typename: "Schedule",
      id: "1",
      events: [
        {
          __typename: "Event",
          startTime: "2026-01-01T00:00:00.000Z",
        },
        {
          __typename: "Event",
          startTime: "2026-02-01T00:00:00.000Z",
        },
      ],
    },
  });

  expect(cache.extract()).toEqual({
    "Schedule:1": {
      __typename: "Schedule",
      id: "1",
      events: [
        {
          __typename: "Event",
          startTime: "2026-01-01T00:00:00.000Z",
        },
        {
          __typename: "Event",
          startTime: "2026-02-01T00:00:00.000Z",
        },
      ],
    },
    __META: {
      extraRootIds: ["Schedule:1"],
    },
  });
});

test("cache.extract(true) serializes scalar values from the optimistic layer", () => {
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

  cache.recordOptimisticTransaction((proxy) => {
    proxy.writeQuery({
      query,
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startTime: new Date("2026-06-15T14:30:00.000Z"),
        },
      },
    });
  }, "optimistic-update");

  expect(cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(cache.extract(true)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: "2026-06-15T14:30:00.000Z",
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

test("parses a scalar field on a custom root type via cache.readQuery", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      RootQuery: {
        queryType: true,
        fields: {
          now: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      now
    }
  `;

  cache.writeQuery({
    query,
    data: {
      now: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    now: new Date("2026-01-01T00:00:00.000Z"),
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

test("parses a scalar field on a custom root type via cache.readFragment", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      RootQuery: {
        queryType: true,
        fields: {
          now: { scalar: "DateTime" },
        },
      },
    },
  });

  const query = gql`
    query {
      now
    }
  `;
  const fragment = gql`
    fragment RootQueryFields on RootQuery {
      now
    }
  `;

  cache.writeQuery({
    query,
    data: {
      now: "2026-01-01T00:00:00.000Z",
    },
  });

  expect(
    cache.readFragment({
      id: "ROOT_QUERY",
      fragment,
    })
  ).toEqual({
    now: new Date("2026-01-01T00:00:00.000Z"),
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
          meetingTimes: { scalar: "[DateTime]" },
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
          availabilitySlots: { scalar: "[[DateTime]]" },
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

test("returns an array-shaped scalar value as a whole when reading", () => {
  const cache = new InMemoryCache({
    scalars: { DateTimeRange: dateTimeRangeScalar },
    typePolicies: {
      Event: {
        fields: {
          dateRange: { scalar: "DateTimeRange" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        dateRange
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        dateRange: ["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      dateRange: {
        start: new Date("2026-01-01T00:00:00.000Z"),
        end: new Date("2026-06-01T00:00:00.000Z"),
      },
    },
  });
});

test("parses each array-shaped scalar when reading a list of array-shaped scalars", () => {
  const cache = new InMemoryCache({
    scalars: { DateTimeRange: dateTimeRangeScalar },
    typePolicies: {
      Event: {
        fields: {
          dateRanges: { scalar: "[DateTimeRange]" },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        dateRanges
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        dateRanges: [
          ["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
          ["2026-07-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"],
        ],
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      dateRanges: [
        {
          start: new Date("2026-01-01T00:00:00.000Z"),
          end: new Date("2026-06-01T00:00:00.000Z"),
        },
        {
          start: new Date("2026-07-01T00:00:00.000Z"),
          end: new Date("2026-12-01T00:00:00.000Z"),
        },
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
          timeSlots: { scalar: "[[DateTime]]" },
        },
      },
      Speaker: {
        fields: {
          availableTimes: { scalar: "[DateTime]" },
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
    WARNINGS.NON_SCALAR_FIELD,
    "Query.event",
    "DateTime"
  );
});

test("ignores a read function and emits a dev warning when the field is configured with a scalar", () => {
  using _ = spyOnConsole("warn");
  const read = jest.fn(() => new Date("2020-06-15T14:30:00.000Z"));

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: { scalar: "DateTime", read },
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

  expect(read).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "DateTime",
    "read"
  );
});

test("ignores both read and merge functions and warns for each when the field is configured with a scalar", () => {
  using _ = spyOnConsole("warn");
  const read = jest.fn(() => new Date("2020-06-15T14:30:00.000Z"));
  const merge = jest.fn((_existing: unknown, incoming: unknown) => incoming);

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: { scalar: "DateTime", read, merge },
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

  expect(read).not.toHaveBeenCalled();
  expect(merge).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledTimes(2);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "DateTime",
    "read"
  );
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "DateTime",
    "merge"
  );
});

test("ignores the merge: true shorthand and warns when the field is configured with a scalar", () => {
  using _ = spyOnConsole("warn");

  const cache = new InMemoryCache({
    scalars: { JSONObject: jsonObjectScalar },
    typePolicies: {
      Product: {
        fields: {
          metadata: { scalar: "JSONObject", merge: true },
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
        metadata: { color: "red" },
      },
    },
  });

  cache.writeQuery({
    query,
    data: {
      product: {
        __typename: "Product",
        id: "1",
        metadata: { size: "large" },
      },
    },
  });

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", product: { __ref: "Product:1" } },
    "Product:1": {
      __typename: "Product",
      id: "1",
      metadata: new Map([["size", "large"]]),
    },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Product.metadata",
    "JSONObject",
    "merge"
  );
});

test("does not apply the implicit keyArgs: false when read and merge functions are ignored for a scalar field", () => {
  using _ = spyOnConsole("warn");

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: {
            scalar: "DateTime",
            read: (existing) => existing,
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      'startTime({"timezone":"UTC"})': new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("warns once for an ignored function no matter how many times the field is written or read", () => {
  using _ = spyOnConsole("warn");

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
        startTime: "2026-06-15T14:30:00.000Z",
      },
    },
  });

  cache.readQuery({ query });
  cache.readQuery({ query });

  expect(console.warn).toHaveBeenCalledTimes(1);
});

test("runs read and merge functions and does not warn when the field policy has no scalar option", () => {
  using _ = spyOnConsole("warn");
  const read = jest.fn((existing: string) => existing.toUpperCase());
  const merge = jest.fn((_existing: unknown, incoming: string) =>
    incoming.trim()
  );

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          name: { read, merge },
        },
      },
    },
  });

  const query = gql`
    query {
      event {
        id
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        name: "  Opening keynote  ",
      },
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      name: "OPENING KEYNOTE",
    },
  });

  expect(read).toHaveBeenCalled();
  expect(merge).toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
});

test("ignores read and merge functions when the scalar option names an unregistered scalar", () => {
  using _ = spyOnConsole("warn");
  const read = jest.fn(() => "read value");
  const merge = jest.fn((_existing: unknown, incoming: unknown) => incoming);

  const cache = new InMemoryCache({
    typePolicies: {
      Event: {
        fields: {
          startTime: { scalar: "Unregistered", read, merge },
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

  expect(read).not.toHaveBeenCalled();
  expect(merge).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledTimes(2);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "Unregistered",
    "read"
  );
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "Unregistered",
    "merge"
  );
});

test("unsets read and merge functions when policies.addTypePolicies adds a scalar to the field", () => {
  using _ = spyOnConsole("warn");
  const read = jest.fn(() => new Date("2020-06-15T14:30:00.000Z"));
  const merge = jest.fn((_existing: unknown, incoming: unknown) => incoming);

  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: { read, merge },
        },
      },
    },
  });

  cache.policies.addTypePolicies({
    Event: {
      fields: {
        startTime: { scalar: "DateTime" },
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(read).not.toHaveBeenCalled();
  expect(merge).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledTimes(2);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "DateTime",
    "read"
  );
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "DateTime",
    "merge"
  );
});

test("ignores read and merge functions added by policies.addTypePolicies to a field that already has a scalar", () => {
  using _ = spyOnConsole("warn");
  const read = jest.fn(() => new Date("2020-06-15T14:30:00.000Z"));
  const merge = jest.fn((_existing: unknown, incoming: unknown) => incoming);

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

  cache.policies.addTypePolicies({
    Event: {
      fields: {
        startTime: { read, merge },
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: { __typename: "Query", event: { __ref: "Event:1" } },
    "Event:1": {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(cache.readQuery({ query })).toEqual({
    event: {
      __typename: "Event",
      id: "1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  expect(read).not.toHaveBeenCalled();
  expect(merge).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledTimes(2);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "DateTime",
    "read"
  );
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "DateTime",
    "merge"
  );
});

test("ignores a read function added by policies.addTypePolicies with the field policy shorthand for a field that already has a scalar", () => {
  using _ = spyOnConsole("warn");
  const read = jest.fn(() => new Date("2020-06-15T14:30:00.000Z"));

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

  cache.policies.addTypePolicies({
    Event: {
      fields: {
        startTime: read,
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

  expect(read).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Event.startTime",
    "DateTime",
    "read"
  );
});

test("deep merges scalar option with policies.addTypePolicies", () => {
  using _ = spyOnConsole("warn");
  const endDateMerge = jest.fn(
    (_existing: unknown, incoming: unknown) => incoming
  );

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
          endDate: { merge: endDateMerge },
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
        timeSlots: { scalar: "[[DateTime]]" },
      },
    },
    Speaker: {
      fields: {
        availableTimes: { scalar: "[DateTime]" },
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

  expect(endDateMerge).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    WARNINGS.SCALAR_FIELD_CONFIG,
    "Conference.endDate",
    "DateTime",
    "merge"
  );
});

test("preserves an existing scalar option when policies.addTypePolicies updates another field option", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: {
            scalar: "DateTime",
          },
        },
      },
    },
  });

  cache.policies.addTypePolicies({
    Event: {
      fields: {
        startTime: {
          keyArgs: ["timezone"],
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

  expect(rawCacheData(cache)).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      event: { __ref: "Event:1" },
    },
    "Event:1": {
      __typename: "Event",
      id: "1",
      'startTime:{"timezone":"UTC"}': new Date("2026-01-01T00:00:00.000Z"),
    },
  });
});

test("maintains referential equality with multiple cache reads", () => {
  const cache = new InMemoryCache({
    scalars: { DateTime: dateTimeScalar },
    typePolicies: {
      Event: {
        fields: {
          startTime: {
            scalar: "DateTime",
          },
        },
      },
    },
  });

  const query: TypedDocumentNode<{
    event: { __typename: "Event"; id: string; startTime: Date };
  }> = gql`
    query {
      event {
        id
        startTime
      }
    }
  `;

  const fragment: TypedDocumentNode<{
    __typename: "Event";
    id: string;
    startTime: Date;
  }> = gql`
    fragment EventFragment on Event {
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
        // @ts-expect-error TODO: Need to figure out types
        startTime: "2026-01-01T00:00:00.000Z",
      },
    },
  });

  const initialValue = cache.readQuery({ query });

  {
    const result = cache.readQuery({ query });

    expect(result!.event.startTime).toBe(initialValue!.event.startTime);
  }

  {
    const result = cache.readFragment({
      fragment,
      from: { __typename: "Event", id: "1" },
    });

    expect(result!.startTime).toBe(initialValue!.event.startTime);
  }
});

// This helper function extracts the raw stored value for tests to actually
// verify we write the parsed value. cache.extract() traverses the result and
// serializes the scalar values which means we can't truly check if the result
// was written correctly.
function rawCacheData(cache: InMemoryCache) {
  return cache["data"].toObject();
}
