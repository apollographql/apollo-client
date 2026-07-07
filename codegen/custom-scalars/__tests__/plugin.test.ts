import { codegen } from "@graphql-codegen/core";
import type { Types } from "@graphql-codegen/plugin-helpers";
import { gql } from "graphql-tag";

import * as customScalarsPlugin from "../plugin.js";

test("outputs empty objects when the schema has no custom scalars", async () => {
  const schema = gql`
    type Query {
      event: Event
    }

    type Event {
      id: ID!
      name: String!
    }
  `;

  const documents = [
    {
      document: gql`
        query GetEvent {
          event {
            id
            name
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({});
});

test("outputs empty objects when custom scalars are only used in field arguments", async () => {
  const schema = gql`
    scalar DateTime

    type Query {
      events(after: DateTime): [Event]
    }

    type Event {
      id: ID!
      name: String!
    }
  `;

  const documents = [
    {
      document: gql`
        query GetEvents($after: DateTime) {
          events(after: $after) {
            id
            name
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({});
});

test("outputs config for input object fields and object fields with custom scalars", async () => {
  const schema = gql`
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      event: Event
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("limits config to custom scalar fields, ignoring built-in scalars and enums", async () => {
  const schema = gql`
    scalar DateTime

    enum Status {
      OPEN
      CLOSED
    }

    input EventInput {
      name: String!
      capacity: Int
      status: Status
      startsAt: DateTime
    }

    type Query {
      event: Event
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      name: String!
      capacity: Int
      status: Status
      startsAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
            name
            capacity
            status
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("handles references to nested input objects", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    DateRange: {
      fields: {
        start: "DateTime",
        end: "DateTime",
      },
    },
    EventFilter: {
      fields: {
        dateRange: "DateRange",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("avoids configuring nested input objects without custom scalars", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query FlightSearch($filter: FlightSearchFilter) {
          flightSearch(filter: $filter) {
            code
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({});
});

test("handles cyclic references between input objects without custom scalars", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query People($filter: PersonFilter) {
          people(filter: $filter) {
            id
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({});
});

test("retains cyclic input objects when a custom scalar is in the cycle", async () => {
  const schema = gql`
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
      bornAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query People($filter: PersonFilter) {
          people(filter: $filter) {
            id
            bornAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    FriendFilter: {
      fields: {
        since: "DateTime",
        person: "PersonFilter",
      },
    },
    PersonFilter: {
      fields: {
        friends: "FriendFilter",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Person: {
      fields: {
        bornAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits fields on retained input objects that reference input objects without custom scalars", async () => {
  const schema = gql`
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
      updatedAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query Search($filter: SearchFilter) {
          search(filter: $filter) {
            id
            updatedAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    DateRange: {
      fields: {
        start: "DateTime",
        end: "DateTime",
      },
    },
    SearchFilter: {
      fields: {
        dateRange: "DateRange",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Result: {
      fields: {
        updatedAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("handles self-referencing input objects", async () => {
  const schema = gql`
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
      completedAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query Tasks($filter: TaskFilter) {
          tasks(filter: $filter) {
            id
            completedAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    TaskFilter: {
      fields: {
        and: "TaskFilter",
        not: "TaskFilter",
        dueBefore: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Task: {
      fields: {
        completedAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits input objects unused by documents while still emitting used object fields", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events {
          events {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("retains only input objects used in document variable definitions", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("outputs empty objects when no documents are provided", async () => {
  const schema = gql`
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      event: Event
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `;

  const { inputObjects, scalarTypePolicies } = await generateConfig({ schema });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({});
});

test("omits unused input objects on fields with multiple input object arguments", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("collects usage across multiple documents", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
        }
      `,
    },
    {
      document: gql`
        query Tickets($filter: TicketFilter) {
          tickets(filter: $filter) {
            id
            purchasedAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
    TicketFilter: {
      fields: {
        purchasedAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
    Ticket: {
      fields: {
        purchasedAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("collects usage from multiple operations in a single document", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
        }

        query Tickets($filter: TicketFilter) {
          tickets(filter: $filter) {
            id
            purchasedAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
    TicketFilter: {
      fields: {
        purchasedAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
    Ticket: {
      fields: {
        purchasedAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("retains input objects used on only one of multiple fields", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: DateRangeFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    DateRangeFilter: {
      fields: {
        start: "DateTime",
        end: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("unwraps list and non-null types for variable definitions and object fields", async () => {
  const schema = gql`
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      events(filters: [EventFilter!]): [Schedule]
    }

    type Schedule {
      id: ID!
      createdAt: DateTime!
      meetingTimes: [DateTime!]!
      availabilitySlots: [[DateTime!]!]
    }
  `;

  const documents = [
    {
      document: gql`
        query Events($filters: [EventFilter!]!) {
          events(filters: $filters) {
            id
            createdAt
            meetingTimes
            availabilitySlots
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Schedule: {
      fields: {
        createdAt: {
          scalar: "DateTime",
        },
        meetingTimes: {
          scalar: "DateTime",
        },
        availabilitySlots: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("retains input objects when mixed with scalar variable definitions", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events($first: Int, $after: DateTime, $filter: EventFilter) {
          events(first: $first, after: $after, filter: $filter) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits input objects when documents only use scalar variable definitions", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events($first: Int, $after: DateTime) {
          events(first: $first, after: $after) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("outputs config for multiple object types with custom scalar fields", async () => {
  const schema = gql`
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      events(filter: EventFilter): [Event]
      speaker: Speaker
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }

    type Speaker {
      id: ID!
      availableFrom: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query GetEventAndSpeaker($filter: EventFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
          speaker {
            id
            availableFrom
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
    Speaker: {
      fields: {
        availableFrom: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("outputs config for multiple custom scalars", async () => {
  const schema = gql`
    scalar DateTime
    scalar Price

    input EventInput {
      startsAt: DateTime
      price: Price
    }

    type Query {
      event: Event
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
      ticketPrice: Price
    }
  `;

  const documents = [
    {
      document: gql`
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
            startsAt
            ticketPrice
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
        price: "Price",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
        ticketPrice: {
          scalar: "Price",
        },
      },
    },
  });
});

test("outputs type policy keyed by field name for object fields with arguments", async () => {
  const schema = gql`
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      events(filter: EventFilter): [Event]
    }

    type Event {
      id: ID!
      startsAt(timezone: String!): DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query GetEvents($filter: EventFilter, $timezone: String!) {
          events(filter: $filter) {
            id
            startsAt(timezone: $timezone)
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("outputs type policies for custom scalar fields on the root query type", async () => {
  const schema = gql`
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      now: DateTime
      events(filter: EventFilter): [Event]
    }

    type Event {
      id: ID!
    }
  `;

  const documents = [
    {
      document: gql`
        query GetNow($filter: EventFilter) {
          now
          events(filter: $filter) {
            id
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Query: {
      fields: {
        now: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("outputs type policies for custom scalar fields on the root mutation type", async () => {
  const schema = gql`
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Mutation {
      lockEvent(id: ID!): DateTime
      createEvent(input: EventInput!): ID
    }
  `;

  const documents = [
    {
      document: gql`
        mutation LockAndCreate($id: ID!, $input: EventInput!) {
          lockEvent(id: $id)
          createEvent(input: $input)
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Mutation: {
      fields: {
        lockEvent: {
          scalar: "DateTime",
        },
      },
    },
  });
});

// TODO: Determine whether we want to configure custom scalars on the interface
// types or concrete types. Configuring the interface types might reduce the
// size of the object, but is more complex in order to avoid writing to the
// concrete types.
test("outputs type policies for concrete types when selecting custom scalar fields from an interface", async () => {
  const schema = gql`
    scalar DateTime

    input ScheduleFilter {
      after: DateTime
    }

    interface Schedulable {
      id: ID!
      startTime: DateTime
    }

    type Session implements Schedulable {
      id: ID!
      startTime: DateTime
      room: String
    }

    type Workshop implements Schedulable {
      id: ID!
      startTime: DateTime
      capacity: Int
    }

    type Query {
      scheduledItems(filter: ScheduleFilter): [Schedulable]
    }
  `;

  const documents = [
    {
      document: gql`
        query GetScheduledItems($filter: ScheduleFilter) {
          scheduledItems(filter: $filter) {
            __typename
            id
            startTime
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    ScheduleFilter: {
      fields: {
        after: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Session: {
      fields: {
        startTime: {
          scalar: "DateTime",
        },
      },
    },
    Workshop: {
      fields: {
        startTime: {
          scalar: "DateTime",
        },
      },
    },
  });
});

// TODO: Determine whether we want to configure custom scalars on the interface
// types or concrete types. Configuring the interface types might reduce the
// size of the object, but is more complex in order to avoid writing to the
// concrete types.
test("outputs type policies for concrete types when selecting custom scalar fields with inline fragments", async () => {
  const schema = gql`
    scalar DateTime

    input ScheduleFilter {
      after: DateTime
    }

    interface Schedulable {
      id: ID!
      startTime: DateTime
    }

    type Session implements Schedulable {
      id: ID!
      startTime: DateTime
      room: String
    }

    type Workshop implements Schedulable {
      id: ID!
      startTime: DateTime
      capacity: Int
    }

    type Query {
      scheduledItems(filter: ScheduleFilter): [Schedulable]
    }
  `;

  const documents = [
    {
      document: gql`
        query GetScheduledItems($filter: ScheduleFilter) {
          scheduledItems(filter: $filter) {
            __typename
            ... on Session {
              id
              startTime
            }
            ... on Workshop {
              id
              startTime
            }
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    ScheduleFilter: {
      fields: {
        after: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Session: {
      fields: {
        startTime: {
          scalar: "DateTime",
        },
      },
    },
    Workshop: {
      fields: {
        startTime: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("collects usage through fragment spreads", async () => {
  const schema = gql`
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      events(filter: EventFilter): [Event]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            ...EventFields
          }
        }

        fragment EventFields on Event {
          id
          startsAt
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("uses the field name instead of the alias when determining type policy usage", async () => {
  const schema = gql`
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      events(filter: EventFilter): [Event]
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
            start: startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("limits type policies to concrete types selected by inline fragments", async () => {
  const schema = gql`
    scalar DateTime

    input ScheduleFilter {
      after: DateTime
    }

    interface Schedulable {
      id: ID!
      startTime: DateTime
    }

    type Session implements Schedulable {
      id: ID!
      startTime: DateTime
      room: String
    }

    type Workshop implements Schedulable {
      id: ID!
      startTime: DateTime
      capacity: Int
    }

    type Query {
      scheduledItems(filter: ScheduleFilter): [Schedulable]
    }
  `;

  const documents = [
    {
      document: gql`
        query GetScheduledItems($filter: ScheduleFilter) {
          scheduledItems(filter: $filter) {
            __typename
            ... on Session {
              id
              startTime
            }
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    ScheduleFilter: {
      fields: {
        after: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Session: {
      fields: {
        startTime: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits object fields not selected in any document", async () => {
  const schema = gql`
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      events(filter: EventFilter): [Event]
    }

    type Event {
      id: ID!
      startsAt: DateTime
      endsAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits object types not used by any document", async () => {
  const schema = gql`
    scalar DateTime

    input EventFilter {
      startsAfter: DateTime
    }

    type Query {
      events(filter: EventFilter): [Event]
      speaker: Speaker
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }

    type Speaker {
      id: ID!
      availableFrom: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits ignored scalar fields from both objects", async () => {
  const schema = gql`
    scalar DateTime
    scalar JSON

    input EventInput {
      startsAt: DateTime
      metadata: JSON
    }

    type Query {
      event: Event
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
      metadata: JSON
    }
  `;

  const documents = [
    {
      document: gql`
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
            startsAt
            metadata
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { ignoreScalars: ["JSON"] },
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits input objects and object types whose only custom scalar is ignored", async () => {
  const schema = gql`
    scalar DateTime
    scalar JSON

    input EventInput {
      startsAt: DateTime
    }

    input MetaInput {
      data: JSON
    }

    type Query {
      event: Event
      product: Product
    }

    type Mutation {
      createEvent(input: EventInput!): Event
      updateMeta(input: MetaInput!): Product
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }

    type Product {
      id: ID!
      metadata: JSON
    }
  `;

  const documents = [
    {
      document: gql`
        mutation Mutate($event: EventInput!, $meta: MetaInput!) {
          createEvent(input: $event) {
            id
            startsAt
          }
          updateMeta(input: $meta) {
            id
            metadata
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { ignoreScalars: ["JSON"] },
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("applies ignored scalars transitively through nested input objects", async () => {
  const schema = gql`
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
  `;

  const documents = [
    {
      document: gql`
        query Events($filter: EventFilter) {
          events(filter: $filter) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { ignoreScalars: ["DateTime"] },
  });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({});
});

test("retains sibling branches when ignored scalars drop a nested input object", async () => {
  const schema = gql`
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
      updatedAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query Search($filter: SearchFilter) {
          search(filter: $filter) {
            id
            updatedAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { ignoreScalars: ["JSON"] },
  });

  expect(inputObjects).toStrictEqual({
    DateRange: {
      fields: {
        start: "DateTime",
        end: "DateTime",
      },
    },
    SearchFilter: {
      fields: {
        dateRange: "DateRange",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Result: {
      fields: {
        updatedAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("outputs empty objects when all custom scalars are ignored", async () => {
  const schema = gql`
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      event: Event
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { ignoreScalars: ["DateTime"] },
  });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({});
});

test("handles ignored scalars that are not in the schema", async () => {
  const schema = gql`
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      event: Event
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { ignoreScalars: ["JSON"] },
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits scalar fields not in includeScalars from both objects", async () => {
  const schema = gql`
    scalar DateTime
    scalar JSON

    input EventInput {
      startsAt: DateTime
      metadata: JSON
    }

    type Query {
      event: Event
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
      metadata: JSON
    }
  `;

  const documents = [
    {
      document: gql`
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
            startsAt
            metadata
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { includeScalars: ["DateTime"] },
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits input objects and object types without included scalars", async () => {
  const schema = gql`
    scalar DateTime
    scalar JSON

    input EventInput {
      startsAt: DateTime
    }

    input MetaInput {
      data: JSON
    }

    type Query {
      event: Event
      product: Product
    }

    type Mutation {
      createEvent(input: EventInput!): Event
      updateMeta(input: MetaInput!): Product
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }

    type Product {
      id: ID!
      metadata: JSON
    }
  `;

  const documents = [
    {
      document: gql`
        mutation Mutate($event: EventInput!, $meta: MetaInput!) {
          createEvent(input: $event) {
            id
            startsAt
          }
          updateMeta(input: $meta) {
            id
            metadata
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { includeScalars: ["DateTime"] },
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("outputs empty objects with an empty includeScalars list", async () => {
  const schema = gql`
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      event: Event
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { includeScalars: [] },
  });

  expect(inputObjects).toStrictEqual({});
  expect(scalarTypePolicies).toStrictEqual({});
});

test("retains sibling branches when non-included scalars drop a nested input object", async () => {
  const schema = gql`
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
      updatedAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query Search($filter: SearchFilter) {
          search(filter: $filter) {
            id
            updatedAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { includeScalars: ["DateTime"] },
  });

  expect(inputObjects).toStrictEqual({
    DateRange: {
      fields: {
        start: "DateTime",
        end: "DateTime",
      },
    },
    SearchFilter: {
      fields: {
        dateRange: "DateRange",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Result: {
      fields: {
        updatedAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("throws when ignoreScalars is used with includeScalars", async () => {
  const schema = gql`
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
      metadata: JSON
    }
  `;

  const documents = [
    {
      document: gql`
        mutation CreateEvent($input: EventInput!) {
          createEvent(input: $input) {
            id
            startsAt
            metadata
          }
        }
      `,
    },
  ];

  await expect(
    runCodegen({
      schema,
      documents,
      config: {
        includeScalars: ["DateTime", "JSON"],
        ignoreScalars: ["JSON"],
      },
    })
  ).rejects.toThrow(/supports 'ignoreScalars' or 'includeScalars'/);
});

test("emits config without documents when filterByDocuments is false", async () => {
  const schema = gql`
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      event: Event
      speaker: Speaker
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
      endsAt: DateTime
    }

    type Speaker {
      id: ID!
      availableFrom: DateTime
    }
  `;

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    config: { filterByDocuments: false },
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
        endsAt: {
          scalar: "DateTime",
        },
      },
    },
    Speaker: {
      fields: {
        availableFrom: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("emits config unused by documents when filterByDocuments is false", async () => {
  const schema = gql`
    scalar DateTime

    input EventInput {
      startsAt: DateTime
    }

    type Query {
      event: Event
      speaker: Speaker
    }

    type Mutation {
      createEvent(input: EventInput!): Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
      endsAt: DateTime
    }

    type Speaker {
      id: ID!
      availableFrom: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query GetEvent {
          event {
            id
            startsAt
          }
        }
      `,
    },
  ];

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    documents,
    config: { filterByDocuments: false },
  });

  expect(inputObjects).toStrictEqual({
    EventInput: {
      fields: {
        startsAt: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
        endsAt: {
          scalar: "DateTime",
        },
      },
    },
    Speaker: {
      fields: {
        availableFrom: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("applies ignoreScalars when filterByDocuments is false", async () => {
  const schema = gql`
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
      metadata: JSON
    }
  `;

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    config: { filterByDocuments: false, ignoreScalars: ["JSON"] },
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

test("omits input objects without custom scalars when filterByDocuments is false", async () => {
  const schema = gql`
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
  `;

  const { inputObjects, scalarTypePolicies } = await generateConfig({
    schema,
    config: { filterByDocuments: false },
  });

  expect(inputObjects).toStrictEqual({
    EventFilter: {
      fields: {
        startsAfter: "DateTime",
      },
    },
  });
  expect(scalarTypePolicies).toStrictEqual({
    Event: {
      fields: {
        startsAt: {
          scalar: "DateTime",
        },
      },
    },
  });
});

// The inline snapshots in the format tests below are intentionally empty. They
// populate on the first `jest -u` run once the plugin emits both `inputObjects`
// and `scalarTypePolicies` in the combined output. Each extension is its own
// test so every snapshot has a unique call site (`test.each` shares one call
// site and can't write multiple inline snapshots).
const formatSchema = gql`
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
`;

const formatDocuments = [
  {
    document: gql`
      mutation CreateEvent($input: EventInput!) {
        createEvent(input: $input) {
          id
          startsAt
        }
      }
    `,
  },
];

test("outputs TypeScript format for .ts files", async () => {
  await expect(
    runCodegen({
      schema: formatSchema,
      documents: formatDocuments,
      filename: "custom-scalars.ts",
    })
  ).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsOption, TypePolicies } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsOption = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};

export const scalarTypePolicies: TypePolicies = {
  \\"Event\\": {
    \\"fields\\": {
      \\"startsAt\\": {
        \\"scalar\\": \\"DateTime\\"
      }
    }
  }
};"
`);
});

test("outputs TypeScript format for .tsx files", async () => {
  await expect(
    runCodegen({
      schema: formatSchema,
      documents: formatDocuments,
      filename: "custom-scalars.tsx",
    })
  ).resolves.toMatchInlineSnapshot(`
"import type { InputObjectsOption, TypePolicies } from \\"@apollo/client/cache\\";

export const inputObjects: InputObjectsOption = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};

export const scalarTypePolicies: TypePolicies = {
  \\"Event\\": {
    \\"fields\\": {
      \\"startsAt\\": {
        \\"scalar\\": \\"DateTime\\"
      }
    }
  }
};"
`);
});

test("outputs JSDoc format for .js files", async () => {
  await expect(
    runCodegen({
      schema: formatSchema,
      documents: formatDocuments,
      filename: "custom-scalars.js",
    })
  ).resolves.toMatchInlineSnapshot(`
"/** @type {import(\\"@apollo/client/cache\\").InputObjectsOption} */
export const inputObjects = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};

/** @type {import(\\"@apollo/client/cache\\").TypePolicies} */
export const scalarTypePolicies = {
  \\"Event\\": {
    \\"fields\\": {
      \\"startsAt\\": {
        \\"scalar\\": \\"DateTime\\"
      }
    }
  }
};"
`);
});

test("outputs JSDoc format for .jsx files", async () => {
  await expect(
    runCodegen({
      schema: formatSchema,
      documents: formatDocuments,
      filename: "custom-scalars.jsx",
    })
  ).resolves.toMatchInlineSnapshot(`
"/** @type {import(\\"@apollo/client/cache\\").InputObjectsOption} */
export const inputObjects = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
    }
  }
};

/** @type {import(\\"@apollo/client/cache\\").TypePolicies} */
export const scalarTypePolicies = {
  \\"Event\\": {
    \\"fields\\": {
      \\"startsAt\\": {
        \\"scalar\\": \\"DateTime\\"
      }
    }
  }
};"
`);
});

test("outputs empty config in JSDoc format for .js files", async () => {
  const schema = gql`
    type Query {
      foo: String
    }
  `;

  await expect(runCodegen({ schema, filename: "custom-scalars.js" })).resolves
    .toMatchInlineSnapshot(`
"/** @type {import(\\"@apollo/client/cache\\").InputObjectsOption} */
export const inputObjects = {};

/** @type {import(\\"@apollo/client/cache\\").TypePolicies} */
export const scalarTypePolicies = {};"
`);
});

test("throws on unsupported file extensions", async () => {
  const schema = gql`
    type Query {
      foo: String
    }
  `;

  await expect(
    runCodegen({ schema, filename: "custom-scalars.json" })
  ).rejects.toThrow(/requires extension to be one of/);

  await expect(
    runCodegen({ schema, filename: "custom-scalars" })
  ).rejects.toThrow(/requires extension to be one of/);
});

async function runCodegen(
  options: Partial<Omit<Types.GenerateOptions, "schema">> &
    Pick<Types.GenerateOptions, "schema">
) {
  return await codegen({
    filename: "custom-scalars.ts",
    documents: [],
    plugins: [{ "@apollo/client-graphql-codegen/custom-scalars": {} }],
    pluginMap: {
      "@apollo/client-graphql-codegen/custom-scalars": customScalarsPlugin,
    },
    config: {},
    ...options,
  });
}

async function generateConfig(options: Parameters<typeof runCodegen>[0]) {
  const output = await runCodegen(options);

  return {
    inputObjects: parseExport(output, "inputObjects"),
    scalarTypePolicies: parseExport(output, "scalarTypePolicies"),
  };
}

// Extracts the object literal assigned to a named export (e.g. `inputObjects`
// or `scalarTypePolicies`) from the generated output. The combined plugin emits
// both exports in a single file, so we anchor on a specific export and read up
// to its terminating `;`. GraphQL names can't contain `;`, so it can't appear
// inside the object literal.
function parseExport(output: string, name: string) {
  const start = output.indexOf(`export const ${name}`);

  if (start === -1) {
    throw new Error(
      `Could not find \`export const ${name}\` in output:\n${output}`
    );
  }

  const objStart = output.indexOf("=", start) + 1;
  const objEnd = output.indexOf(";", objStart);

  return JSON.parse(output.slice(objStart, objEnd));
}
