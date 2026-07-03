import { codegen } from "@graphql-codegen/core";
import type { Types } from "@graphql-codegen/plugin-helpers";
import { gql } from "graphql-tag";

import * as scalarTypePoliciesPlugin from "../plugin.js";

test("outputs empty object with no custom scalars in schema", async () => {
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

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({});
});

test("outputs empty object when custom scalars are only used in arguments", async () => {
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

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({});
});

test("outputs type policies for object fields with custom scalars", async () => {
  const schema = gql`
    scalar DateTime

    type Query {
      event: Event
    }

    type Event {
      id: ID!
      name: String!
      startsAt: DateTime
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

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Event: {
      fields: {
        startsAt: { scalar: "DateTime" },
      },
    },
  });
});

test("limits type policies to fields with custom scalars", async () => {
  const schema = gql`
    scalar DateTime

    enum EventStatus {
      SCHEDULED
      CANCELLED
    }

    type Query {
      event: Event
    }

    type Event {
      id: ID!
      name: String!
      capacity: Int
      status: EventStatus
      startsAt: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query GetEvent {
          event {
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

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Event: {
      fields: {
        startsAt: { scalar: "DateTime" },
      },
    },
  });
});

test("outputs type policies for multiple object types with custom scalar fields", async () => {
  const schema = gql`
    scalar DateTime

    type Query {
      event: Event
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
        query GetEventAndSpeaker {
          event {
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

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Event: {
      fields: {
        startsAt: { scalar: "DateTime" },
      },
    },
    Speaker: {
      fields: {
        availableFrom: { scalar: "DateTime" },
      },
    },
  });
});

test("outputs type policies for multiple custom scalars", async () => {
  const schema = gql`
    scalar DateTime
    scalar Price

    type Query {
      event: Event
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
        query GetEvent {
          event {
            id
            startsAt
            ticketPrice
          }
        }
      `,
    },
  ];

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Event: {
      fields: {
        startsAt: { scalar: "DateTime" },
        ticketPrice: { scalar: "Price" },
      },
    },
  });
});

test("unwraps non-null and list types when determining the field scalar", async () => {
  const schema = gql`
    scalar DateTime

    type Query {
      schedule: Schedule
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
        query GetSchedule {
          schedule {
            id
            createdAt
            meetingTimes
            availabilitySlots
          }
        }
      `,
    },
  ];

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Schedule: {
      fields: {
        createdAt: { scalar: "DateTime" },
        meetingTimes: { scalar: "DateTime" },
        availabilitySlots: { scalar: "DateTime" },
      },
    },
  });
});

test("outputs type policy keyed by field name for fields with arguments", async () => {
  const schema = gql`
    scalar DateTime

    type Query {
      event: Event
    }

    type Event {
      id: ID!
      startsAt(timezone: String!): DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query GetEvent($timezone: String!) {
          event {
            id
            startsAt(timezone: $timezone)
          }
        }
      `,
    },
  ];

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Event: {
      fields: {
        startsAt: { scalar: "DateTime" },
      },
    },
  });
});

test("outputs type policies for custom scalar fields on the root query type", async () => {
  const schema = gql`
    scalar DateTime

    type Query {
      now: DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        query GetNow {
          now
        }
      `,
    },
  ];

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Query: {
      fields: {
        now: { scalar: "DateTime" },
      },
    },
  });
});

test("outputs type policies for custom scalar fields on the root mutation type", async () => {
  const schema = gql`
    scalar DateTime

    type Mutation {
      lockEvent(id: ID!): DateTime
    }
  `;

  const documents = [
    {
      document: gql`
        mutation LockEvent($id: ID!) {
          lockEvent(id: $id)
        }
      `,
    },
  ];

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Mutation: {
      fields: {
        lockEvent: { scalar: "DateTime" },
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
      scheduledItems: [Schedulable]
    }
  `;

  const documents = [
    {
      document: gql`
        query GetScheduledItems {
          scheduledItems {
            __typename
            id
            startTime
          }
        }
      `,
    },
  ];

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Session: {
      fields: {
        startTime: { scalar: "DateTime" },
      },
    },
    Workshop: {
      fields: {
        startTime: { scalar: "DateTime" },
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
      scheduledItems: [Schedulable]
    }
  `;

  const documents = [
    {
      document: gql`
        query GetScheduledItems {
          scheduledItems {
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

  await expect(
    generateTypePolicies({ schema, documents })
  ).resolves.toStrictEqual({
    Session: {
      fields: {
        startTime: { scalar: "DateTime" },
      },
    },
    Workshop: {
      fields: {
        startTime: { scalar: "DateTime" },
      },
    },
  });
});

test("omits ignored scalar fields from type policies", async () => {
  const schema = gql`
    scalar DateTime
    scalar JSON

    type Query {
      event: Event
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
        query GetEvent {
          event {
            id
            startsAt
            metadata
          }
        }
      `,
    },
  ];

  await expect(
    generateTypePolicies({
      schema,
      documents,
      config: { ignoreScalars: ["JSON"] },
    })
  ).resolves.toStrictEqual({
    Event: {
      fields: {
        startsAt: { scalar: "DateTime" },
      },
    },
  });
});

test("omits object types whose only custom scalar fields are ignored", async () => {
  const schema = gql`
    scalar DateTime
    scalar JSON

    type Query {
      event: Event
      product: Product
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
        query GetEventAndProduct {
          event {
            id
            startsAt
          }
          product {
            id
            metadata
          }
        }
      `,
    },
  ];

  await expect(
    generateTypePolicies({
      schema,
      documents,
      config: { ignoreScalars: ["JSON"] },
    })
  ).resolves.toStrictEqual({
    Event: {
      fields: {
        startsAt: { scalar: "DateTime" },
      },
    },
  });
});

test("outputs empty object when all custom scalars are ignored", async () => {
  const schema = gql`
    scalar DateTime

    type Query {
      event: Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
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

  await expect(
    generateTypePolicies({
      schema,
      documents,
      config: { ignoreScalars: ["DateTime"] },
    })
  ).resolves.toStrictEqual({});
});

test("handles ignored scalars that are not in the schema", async () => {
  const schema = gql`
    scalar DateTime

    type Query {
      event: Event
    }

    type Event {
      id: ID!
      startsAt: DateTime
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

  await expect(
    generateTypePolicies({
      schema,
      documents,
      config: { ignoreScalars: ["JSON"] },
    })
  ).resolves.toStrictEqual({
    Event: {
      fields: {
        startsAt: { scalar: "DateTime" },
      },
    },
  });
});

async function runCodegen(
  options: Partial<Omit<Types.GenerateOptions, "schema">> &
    Pick<Types.GenerateOptions, "schema">
) {
  return await codegen({
    filename: "scalar-type-policies.ts",
    documents: [],
    plugins: [{ "@apollo/client-graphql-codegen/scalar-type-policies": {} }],
    pluginMap: {
      "@apollo/client-graphql-codegen/scalar-type-policies":
        scalarTypePoliciesPlugin,
    },
    config: {},
    ...options,
  });
}

async function generateTypePolicies(options: Parameters<typeof runCodegen>[0]) {
  const output = await runCodegen(options);

  return JSON.parse(
    output.slice(output.indexOf("= ") + 2, output.lastIndexOf(";"))
  );
}
