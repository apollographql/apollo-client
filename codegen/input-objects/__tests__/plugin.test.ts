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

  expect(output).toMatchInlineSnapshot(`""`);
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
      date: DateTime
    }
  `);

  const output = await runCodegen({ schema });

  expect(output).toMatchInlineSnapshot(`""`);
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
