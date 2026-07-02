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

test("outputs empty object for custom scalars only used as args or field types", async () => {
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

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
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

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
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

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"EventFilter\\": {
    \\"fields\\": {
      \\"dateRange\\": \\"DateRange\\"
    }
  },
  \\"DateRange\\": {
    \\"fields\\": {
      \\"start\\": \\"DateTime\\",
      \\"end\\": \\"DateTime\\"
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

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
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

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
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

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"PersonFilter\\": {
    \\"fields\\": {
      \\"friends\\": \\"FriendFilter\\"
    }
  },
  \\"FriendFilter\\": {
    \\"fields\\": {
      \\"since\\": \\"DateTime\\",
      \\"person\\": \\"PersonFilter\\"
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

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsConfig } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsConfig = {
  \\"SearchFilter\\": {
    \\"fields\\": {
      \\"dateRange\\": \\"DateRange\\"
    }
  },
  \\"DateRange\\": {
    \\"fields\\": {
      \\"start\\": \\"DateTime\\",
      \\"end\\": \\"DateTime\\"
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

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
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

  await expect(runCodegen({ schema })).resolves.toMatchInlineSnapshot(`
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
