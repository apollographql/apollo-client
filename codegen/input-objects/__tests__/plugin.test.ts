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

  const output = await runCodegen({ schema });

  expect(output).toMatchInlineSnapshot(`"export const inputObjects = {};"`);
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

  const output = await runCodegen({ schema });

  expect(output).toMatchInlineSnapshot(`"export const inputObjects = {};"`);
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

  const output = await runCodegen({ schema });

  expect(output).toMatchInlineSnapshot(`
"export const inputObjects = {
  \\"EventInput\\": {
    \\"fields\\": {
      \\"startsAt\\": \\"DateTime\\"
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
