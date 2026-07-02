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
