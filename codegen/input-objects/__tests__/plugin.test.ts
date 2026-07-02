import { codegen } from "@graphql-codegen/core";
import type { Types } from "@graphql-codegen/plugin-helpers";
import { parse } from "graphql";

import { plugin } from "../plugin.js";

test("outputs empty object with no input objects in schema", async () => {
  const schema = parse(/* GraphQL */ `
    type Query {
      foo: String
    }
  `);

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {};"
`);
});

test("outputs empty object with no input objects in schema with custom scalars", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    type Query {
      event(at: DateTime): Event
    }

    type Event {
      id: ID!
      name: String!
      startsAt: DateTime
    }
  `);

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {};"
`);
});

test("outputs input object that includes custom scalar", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      name: String!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("limits input object to custom scalar types only", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventInput {
      name: String!
      capacity: Int
      startsAt: DateTime
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      name: String!
      capacity: Int
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("handles references to nested input objects", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventFilter {
      dateRange: DateRange
    }

    input DateRange {
      start: DateTime!
      end: DateTime!
    }

    type Query {
      events(filter: EventFilter): [Event]
    }

    type Event {
      id: ID!
      name: String!
      capacity: Int
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"DateRange\\": {
    \\"fields\\": {
      \\"start\\": \\"DateTime\\",
      \\"end\\": \\"DateTime\\"
    }
  },
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"dateRange\\": \\"DateRange\\"
    }
  }
};"
`);
});

test("avoids configuring nested input objects without custom scalars", async () => {
  const schema = parse(/* GraphQL */ `
    input DateRange {
      start: String!
      end: String!
    }

    input FlightSearchFilter {
      dateRange: DateRange
      destination: DestinationFilter
    }

    input DestinationFilter {
      airport: AirportFilter
    }

    input AirportFilter {
      city: String
      code: String
    }

    type Query {
      flightSearch(filter: FlightSearchFilter): [Flight]
    }

    type Flight {
      code: String!
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query FlightSearch($filter: FlightSearchFilter) {
          flightSearch(filter: $filter) {
            code
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {};"
`);
});

test("handles cyclic references between input objects without custom scalars", async () => {
  const schema = parse(/* GraphQL */ `
    input PersonFilter {
      name: String
      friends: FriendFilter
    }

    input FriendFilter {
      person: PersonFilter
    }

    type Query {
      people(filter: PersonFilter): [Person]
    }

    type Person {
      id: ID!
      name: String!
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query People($filter: PersonFilter) {
          people(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {};"
`);
});

test("retains cyclic input objects when a custom scalar is in the cycle", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input PersonFilter {
      name: String
      friends: FriendFilter
    }

    input FriendFilter {
      since: DateTime
      person: PersonFilter
    }

    type Query {
      people(filter: PersonFilter): [Person]
    }

    type Person {
      id: ID!
      name: String!
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query People($filter: PersonFilter) {
          people(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"FriendFilter\\": {
    \\"fields\\": {
      \\"since\\": \\"DateTime\\",
      \\"person\\": \\"PersonFilter\\"
    }
  },
  \\"PersonFilter\\": {
    \\"fields\\": {
      \\"friends\\": \\"FriendFilter\\"
    }
  }
};"
`);
});

test("omits fields on retained input objects that reference input objects without custom scalars", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input SearchFilter {
      dateRange: DateRange
      pagination: PaginationInput
    }

    input DateRange {
      start: DateTime
      end: DateTime
    }

    input PaginationInput {
      limit: Int
      offset: Int
    }

    type Query {
      search(filter: SearchFilter): [Result]
    }

    type Result {
      id: ID!
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Search($filter: SearchFilter) {
          search(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"DateRange\\": {
    \\"fields\\": {
      \\"start\\": \\"DateTime\\",
      \\"end\\": \\"DateTime\\"
    }
  },
  \\"SearchFilter\\": {
    \\"fields\\": {
      \\"dateRange\\": \\"DateRange\\"
    }
  }
};"
`);
});

test("handles self-referencing input objects", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input TaskFilter {
      and: [TaskFilter!]
      not: TaskFilter
      dueBefore: DateTime
    }

    type Query {
      tasks(filter: TaskFilter): [Task]
    }

    type Task {
      id: ID!
      name: String!
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Tasks($filter: TaskFilter) {
          tasks(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"TaskFilter\\": {
    \\"fields\\": {
      \\"and\\": \\"TaskFilter\\",
      \\"not\\": \\"TaskFilter\\",
      \\"dueBefore\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("omits enum fields from retained input objects", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    enum Status {
      OPEN
      CLOSED
    }

    input TicketFilter {
      status: Status
      after: DateTime
    }

    type Query {
      tickets(filter: TicketFilter): [Ticket]
    }

    type Ticket {
      id: ID!
      status: Status
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Tickets($filter: TicketFilter) {
          tickets(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"TicketFilter\\": {
    \\"fields\\": {
      \\"after\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("omits input objects when no document uses them", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      events: [Event]
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events {
          events {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {};"
`);
});

test("retains only input objects used in document variable definitions", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    input TicketFilter {
      purchasedAfter: DateTime
    }

    type Query {
      events(filter: EventFilter): [Event]
      tickets(filter: TicketFilter): [Ticket]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }

    type Ticket {
      id: ID!
      purchasedAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"startsAfter\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("outputs empty object when no documents are provided", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {};"
`);
});

test("omits unused input objects on fields with multiple input object arguments", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    input EventOptions {
      asOf: DateTime
    }

    type Query {
      events(filter: EventFilter, options: EventOptions): [Event]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"startsAfter\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("collects usage across multiple documents", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    input TicketFilter {
      purchasedAfter: DateTime
    }

    input ReportFilter {
      generatedAfter: DateTime
    }

    type Query {
      events(filter: EventFilter): [Event]
      tickets(filter: TicketFilter): [Ticket]
      reports(filter: ReportFilter): [Report]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }

    type Ticket {
      id: ID!
      purchasedAt: DateTime
    }

    type Report {
      id: ID!
      generatedAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
          }
        }
      `),
    },
    {
      document: parse(/* GraphQL */ `
        query Tickets($filter: TicketFilter) {
          tickets(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"startsAfter\\": \\"DateTime\\"
    }
  },
  \\"TicketFilter\\": {
    \\"fields\\": {
      \\"purchasedAfter\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("retains input objects used on only one of multiple fields", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input DateRangeFilter {
      start: DateTime
      end: DateTime
    }

    type Query {
      events(filter: DateRangeFilter): [Event]
      tickets(filter: DateRangeFilter): [Ticket]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }

    type Ticket {
      id: ID!
      purchasedAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($filter: DateRangeFilter) {
          events(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"DateRangeFilter\\": {
    \\"fields\\": {
      \\"start\\": \\"DateTime\\",
      \\"end\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("handles list and non-null wrapped variable types", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      events(filters: [EventFilter!]): [Event]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($filters: [EventFilter!]!) {
          events(filters: $filters) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"startsAfter\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("collects usage from multiple operations in a single document", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    input TicketFilter {
      purchasedAfter: DateTime
    }

    type Query {
      events(filter: EventFilter): [Event]
      tickets(filter: TicketFilter): [Ticket]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }

    type Ticket {
      id: ID!
      purchasedAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
          }
        }

        query Tickets($filter: TicketFilter) {
          tickets(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"startsAfter\\": \\"DateTime\\"
    }
  },
  \\"TicketFilter\\": {
    \\"fields\\": {
      \\"purchasedAfter\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("retains input objects when mixed with scalar variable definitions", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      events(first: Int, after: DateTime, filter: EventFilter): [Event]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($first: Int, $after: DateTime, $filter: EventFilter) {
          events(first: $first, after: $after, filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"startsAfter\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("omits input objects when documents only use scalar variable definitions", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      events(first: Int, after: DateTime): [Event]
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($first: Int, $after: DateTime) {
          events(first: $first, after: $after) {
            id
          }
        }
      `),
    },
  ];

  await expect(runCodegen({ schema, documents })).resolves
    .toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {};"
`);
});

test("omits ignored scalar fields from input objects", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime
    scalar JSON

    input EventInput {
      startsAt: DateTime
      metadata: JSON
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
          }
        }
      `),
    },
  ];

  await expect(
    runCodegen({ schema, documents, config: { ignoreScalars: ["JSON"] } })
  ).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("omits input objects whose only custom scalar is ignored", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
          }
        }
      `),
    },
  ];

  await expect(
    runCodegen({ schema, documents, config: { ignoreScalars: ["DateTime"] } })
  ).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {};"
`);
});

test("applies ignored scalars transitively through nested input objects", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventFilter {
      dateRange: DateRange
    }

    input DateRange {
      start: DateTime!
      end: DateTime!
    }

    type Query {
      events(filter: EventFilter): [Event]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(
    runCodegen({ schema, documents, config: { ignoreScalars: ["DateTime"] } })
  ).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {};"
`);
});

test("retains sibling branches when ignored scalars drop a nested input object", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime
    scalar JSON

    input SearchFilter {
      dateRange: DateRange
      meta: MetaInput
    }

    input DateRange {
      start: DateTime
      end: DateTime
    }

    input MetaInput {
      data: JSON
    }

    type Query {
      search(filter: SearchFilter): [Result]
    }

    type Result {
      id: ID!
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Search($filter: SearchFilter) {
          search(filter: $filter) {
            id
          }
        }
      `),
    },
  ];

  await expect(
    runCodegen({ schema, documents, config: { ignoreScalars: ["JSON"] } })
  ).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"DateRange\\": {
    \\"fields\\": {
      \\"start\\": \\"DateTime\\",
      \\"end\\": \\"DateTime\\"
    }
  },
  \\"SearchFilter\\": {
    \\"fields\\": {
      \\"dateRange\\": \\"DateRange\\"
    }
  }
};"
`);
});

test("handles ignored scalars that are not in the schema", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
          }
        }
      `),
    },
  ];

  await expect(
    runCodegen({ schema, documents, config: { ignoreScalars: ["JSON"] } })
  ).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("emits input objects with custom scalars without documents when filterByDocuments is false", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  await expect(runCodegen({ schema, config: { filterByDocuments: false } }))
    .resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("emits input objects unused by documents when filterByDocuments is false", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      events: [Event]
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  const documents = [
    {
      document: parse(/* GraphQL */ `
        query Events {
          events {
            id
          }
        }
      `),
    },
  ];

  await expect(
    runCodegen({ schema, documents, config: { filterByDocuments: false } })
  ).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("omits input objects without custom scalars when filterByDocuments is false", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    input PaginationInput {
      limit: Int
      offset: Int
    }

    type Query {
      events(filter: EventFilter, pagination: PaginationInput): [Event]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  await expect(runCodegen({ schema, config: { filterByDocuments: false } }))
    .resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"startsAfter\\": \\"DateTime\\"
    }
  }
};"
`);
});

test("applies ignoreScalars when filterByDocuments is false", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime
    scalar JSON

    input EventFilter {
      startsAfter: DateTime
    }

    input MetaInput {
      data: JSON
    }

    type Query {
      events(filter: EventFilter, meta: MetaInput): [Event]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `);

  await expect(
    runCodegen({
      schema,
      config: { filterByDocuments: false, ignoreScalars: ["JSON"] },
    })
  ).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"startsAfter\\": \\"DateTime\\"
    }
  }
};"
`);
});

async function runCodegen(
  options: Partial<Omit<Types.GenerateOptions, "schema">> &
    Pick<Types.GenerateOptions, "schema">
) {
  return await codegen({
    filename: "input-objects.ts",
    documents: [],
    plugins: [{ "@apollo/client-graphql-codegen/input-objects": {} }],
    pluginMap: {
      "@apollo/client-graphql-codegen/input-objects": {
        plugin,
      },
    },
    config: {},
    ...options,
  });
}
