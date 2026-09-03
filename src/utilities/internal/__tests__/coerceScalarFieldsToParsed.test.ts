import { gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import {
  dateScalar,
  dateTimeRangeScalar,
  dateTimeScalar,
  jsonObjectScalar,
  priceScalar,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { coerceScalarFieldsToParsed } from "@apollo/client/utilities/internal";

const WARNINGS = {
  LIST_SCALAR_MISMATCH:
    "The custom scalar configuration for '%s' uses list type '%s', but the value is not an array. The value was coerced as '%s' anyway.",
};

test("parses custom scalar fields on nested objects", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        name
        startDate
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      name: "GraphQL Summit",
      startDate: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      name: "GraphQL Summit",
      startDate: new Date(2026, 0, 1),
    },
  });
});

test("parses custom scalar fields when the query selects __typename", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        __typename
        id
        startDate
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      startDate: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 0, 1),
    },
  });
});

test("does not parse fields on objects without a __typename", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Query: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
      Conference: {
        fields: {
          openedAt: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query EventAndConference {
      event {
        id
        startDate
      }
      conference {
        id
        venue {
          openedAt
        }
      }
    }
  `;

  const result = {
    event: {
      id: "1",
      startDate: "2026-01-01",
    },
    conference: {
      __typename: "Conference",
      id: "2",
      venue: {
        openedAt: "2026-02-02",
      },
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      id: "1",
      startDate: "2026-01-01",
    },
    conference: {
      __typename: "Conference",
      id: "2",
      venue: {
        openedAt: "2026-02-02",
      },
    },
  });
});

test("parses custom scalar fields on root fields", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Query: {
        fields: {
          today: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Today {
      today
    }
  `;

  const result = { today: "2026-01-01" };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    today: new Date(2026, 0, 1),
  });
});

test("parses custom scalar fields for aliased fields", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        start: startDate
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      start: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      start: new Date(2026, 0, 1),
    },
  });
});

test("parses custom scalar fields in deeply nested objects", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Session: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        keynote {
          id
          session {
            id
            startDate
          }
        }
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      keynote: {
        __typename: "Talk",
        id: "2",
        session: {
          __typename: "Session",
          id: "3",
          startDate: "2026-01-01",
        },
      },
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      keynote: {
        __typename: "Talk",
        id: "2",
        session: {
          __typename: "Session",
          id: "3",
          startDate: new Date(2026, 0, 1),
        },
      },
    },
  });
});

test("parses custom scalar fields for objects in a list", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Events {
      events {
        id
        startDate
      }
    }
  `;

  const result = {
    events: [
      { __typename: "Event", id: "1", startDate: "2026-01-01" },
      { __typename: "Event", id: "2", startDate: "2026-06-15" },
    ],
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    events: [
      { __typename: "Event", id: "1", startDate: new Date(2026, 0, 1) },
      { __typename: "Event", id: "2", startDate: new Date(2026, 5, 15) },
    ],
  });
});

test("parses custom scalar values in a list of scalars", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          dates: { scalar: "[Date]" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        dates
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      dates: ["2026-01-01", "2026-06-15"],
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      dates: [new Date(2026, 0, 1), new Date(2026, 5, 15)],
    },
  });
});

test("parses custom scalar fields for objects in a list of lists", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query EventsByYear {
      eventsByYear {
        id
        startDate
      }
    }
  `;

  const result = {
    eventsByYear: [
      [
        { __typename: "Event", id: "1", startDate: "2026-01-01" },
        { __typename: "Event", id: "2", startDate: "2026-06-15" },
      ],
      [{ __typename: "Event", id: "3", startDate: "2027-03-10" }],
    ],
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    eventsByYear: [
      [
        { __typename: "Event", id: "1", startDate: new Date(2026, 0, 1) },
        { __typename: "Event", id: "2", startDate: new Date(2026, 5, 15) },
      ],
      [{ __typename: "Event", id: "3", startDate: new Date(2027, 2, 10) }],
    ],
  });
});

test("parses custom scalar values in a list of lists", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          datesByYear: { scalar: "[[Date]]" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        datesByYear
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      datesByYear: [["2026-01-01", "2026-06-15"], ["2027-03-10"]],
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      datesByYear: [
        [new Date(2026, 0, 1), new Date(2026, 5, 15)],
        [new Date(2027, 2, 10)],
      ],
    },
  });
});

test("passes an array-shaped scalar value to parse as a whole", () => {
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
    query Event {
      event {
        id
        dateRange
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      dateRange: ["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
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

test("parses each array-shaped scalar in a list of array-shaped scalars", () => {
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
    query Event {
      event {
        id
        dateRanges
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      dateRanges: [
        ["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
        ["2026-07-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"],
      ],
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
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
    query Event {
      event {
        id
        dates
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      dates: "2026-01-01T00:00:00.000Z",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
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

test("parses custom scalar fields selected by a named fragment", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        ...EventFields
      }
    }

    fragment EventFields on Event {
      name
      startDate
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      name: "GraphQL Summit",
      startDate: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      name: "GraphQL Summit",
      startDate: new Date(2026, 0, 1),
    },
  });
});

test("parses custom scalar fields selected by nested fragments", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        ...EventFields
      }
    }

    fragment EventFields on Event {
      name
      ...EventDateFields
    }

    fragment EventDateFields on Event {
      startDate
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      name: "GraphQL Summit",
      startDate: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      name: "GraphQL Summit",
      startDate: new Date(2026, 0, 1),
    },
  });
});

test("parses custom scalar fields selected by an inline fragment", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        ... on Event {
          startDate
        }
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      startDate: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 0, 1),
    },
  });
});

test("parses custom scalar fields selected by an inline fragment without a type condition", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        ... {
          startDate
        }
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      startDate: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 0, 1),
    },
  });
});

test("parses custom scalar fields selected by a fragment spread at the root of the query", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
      User: {
        fields: {
          lastSeenAt: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query EventAndViewer {
      event {
        id
        startDate
      }
      ...ViewerFields
    }

    fragment ViewerFields on Query {
      viewer {
        id
        lastSeenAt
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      startDate: "2026-01-01",
    },
    viewer: {
      __typename: "User",
      id: "2",
      lastSeenAt: "2026-02-02",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 0, 1),
    },
    viewer: {
      __typename: "User",
      id: "2",
      lastSeenAt: new Date(2026, 1, 2),
    },
  });
});

test("keeps parsed values when a fragment selects no custom scalar fields", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        startDate
        ...EventName
      }
    }

    fragment EventName on Event {
      name
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      name: "GraphQL Summit",
      startDate: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      name: "GraphQL Summit",
      startDate: new Date(2026, 0, 1),
    },
  });
});

test("parses custom scalar fields selected by a fragment on an interface type", () => {
  const cache = new InMemoryCache({
    possibleTypes: { Node: ["Event"] },
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          createdAt: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        ... on Node {
          createdAt
        }
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      createdAt: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      createdAt: new Date(2026, 0, 1),
    },
  });
});

test("does not parse fields selected by a fragment on a supertype missing from possibleTypes", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
          createdAt: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        startDate
        ... on Node {
          createdAt
        }
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      startDate: "2026-06-15",
      createdAt: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 5, 15),
      createdAt: "2026-01-01",
    },
  });
});

test("ignores fields from inline fragments that don't match the returned type", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Dog: {
        fields: {
          adoptedAt: { scalar: "Date" },
        },
      },
      Cat: {
        fields: {
          microchippedAt: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Pet {
      pet {
        ... on Dog {
          name
          adoptedAt
        }
        ... on Cat {
          name
          microchippedAt
        }
      }
    }
  `;

  const result = {
    pet: {
      __typename: "Dog",
      name: "Fido",
      adoptedAt: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    pet: {
      __typename: "Dog",
      name: "Fido",
      adoptedAt: new Date(2026, 0, 1),
    },
  });
});

test("does not coerce an overlapping alias using a non-matching fragment field", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar, Price: priceScalar },
    typePolicies: {
      Dog: {
        fields: {
          lastWalkedAt: { scalar: "Date" },
          lastFedAt: { scalar: "Price" },
        },
      },
      Cat: {
        fields: {
          lastFedAt: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Pet {
      pet {
        ... on Dog {
          when: lastWalkedAt
        }
        ... on Cat {
          when: lastFedAt
        }
      }
    }
  `;

  const result = {
    pet: {
      __typename: "Dog",
      when: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    pet: {
      __typename: "Dog",
      when: new Date(2026, 0, 1),
    },
  });
});

test("does not parse values that are already parsed", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 0, 1),
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 0, 1),
    },
  });
});

test("leaves null scalar values as-is", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      startDate: null,
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      startDate: null,
    },
  });
});

test("leaves null values in a list as-is", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
          dates: { scalar: "[Date]" },
        },
      },
    },
  });

  const query = gql`
    query Events {
      events {
        id
        startDate
        dates
      }
    }
  `;

  const result = {
    events: [
      null,
      {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
        dates: [null, "2026-06-15"],
      },
    ],
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    events: [
      null,
      {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        dates: [null, new Date(2026, 5, 15)],
      },
    ],
  });
});

test("leaves null objects as-is", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;

  const result = { event: null };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: null,
  });
});

test("does not modify fields without a configured scalar", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
  });

  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      startDate: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toBe(result);
});

test("maintains referential equality of unchanged subtrees", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query EventAndViewer {
      event {
        id
        startDate
      }
      viewer {
        id
        name
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      startDate: "2026-01-01",
    },
    viewer: {
      __typename: "User",
      id: "2",
      name: "Test User",
    },
  };

  const coerced = coerceScalarFieldsToParsed(result, query, cache);

  expect(coerced).not.toBe(result);
  expect(coerced.event).not.toBe(result.event);
  expect(coerced.viewer).toBe(result.viewer);
});

test("maintains referential equality of unchanged objects in a list", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Event: {
        fields: {
          startDate: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Events {
      events {
        id
        name
      }
    }
  `;

  const result = {
    events: [
      { __typename: "Event", id: "1", name: "GraphQL Summit" },
      { __typename: "Event", id: "2", name: "GraphQL Conf" },
    ],
  };

  const coerced = coerceScalarFieldsToParsed(result, query, cache);

  expect(coerced).toBe(result);
  expect(coerced.events).toBe(result.events);
});

test("parses scalars that serialize to primitive values", () => {
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
    query Product {
      product {
        id
        price
      }
    }
  `;

  const result = {
    product: {
      __typename: "Product",
      id: "1",
      price: 1099,
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    product: {
      __typename: "Product",
      id: "1",
      price: "10.99",
    },
  });
});

test("parses scalars that serialize to object values", () => {
  const cache = new InMemoryCache({
    scalars: { JSONObject: jsonObjectScalar },
    typePolicies: {
      Event: {
        fields: {
          metadata: { scalar: "JSONObject" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        metadata
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      metadata: { attendees: 500 },
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      metadata: new Map([["attendees", 500]]),
    },
  });
});

test("parses custom scalar fields on mutation root fields", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      Mutation: {
        fields: {
          touchedAt: { scalar: "Date" },
        },
      },
    },
  });

  const mutation = gql`
    mutation TouchEvent {
      touchedAt
    }
  `;

  const result = { touchedAt: "2026-01-01" };

  expect(
    coerceScalarFieldsToParsed(result, mutation, cache)
  ).toStrictEqualTyped({
    touchedAt: new Date(2026, 0, 1),
  });
});

test("parses custom scalar fields on renamed root types", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar },
    typePolicies: {
      RootQuery: {
        queryType: true,
        fields: {
          today: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Today {
      today
    }
  `;

  const result = { today: "2026-01-01" };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    today: new Date(2026, 0, 1),
  });
});

test("parses custom scalar fields configured on an interface type", () => {
  const cache = new InMemoryCache({
    possibleTypes: { Node: ["Event"] },
    scalars: { Date: dateScalar },
    typePolicies: {
      Node: {
        fields: {
          createdAt: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Event {
      event {
        id
        createdAt
      }
    }
  `;

  const result = {
    event: {
      __typename: "Event",
      id: "1",
      createdAt: "2026-01-01",
    },
  };

  expect(coerceScalarFieldsToParsed(result, query, cache)).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      createdAt: new Date(2026, 0, 1),
    },
  });
});

test("does not reparse values when run against an already parsed result", () => {
  const cache = new InMemoryCache({
    scalars: { Date: dateScalar, Price: priceScalar },
    typePolicies: {
      Product: {
        fields: {
          price: { scalar: "Price" },
          releasedAt: { scalar: "Date" },
        },
      },
    },
  });

  const query = gql`
    query Product {
      product {
        id
        price
        releasedAt
      }
    }
  `;

  const result = {
    product: {
      __typename: "Product",
      id: "1",
      price: 1099,
      releasedAt: "2026-01-01",
    },
  };

  const parsed = coerceScalarFieldsToParsed(result, query, cache);

  expect(parsed).toStrictEqualTyped({
    product: {
      __typename: "Product",
      id: "1",
      price: "10.99",
      releasedAt: new Date(2026, 0, 1),
    },
  });
  expect(coerceScalarFieldsToParsed(parsed, query, cache)).toBe(parsed);
});
