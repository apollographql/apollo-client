import { codegen } from "@graphql-codegen/core";
import type { Types } from "@graphql-codegen/plugin-helpers";
import { parse } from "graphql";

import { plugin } from "../plugin.js";

test("works", async () => {
  const schema = parse(/* GraphQL */ `
    scalar DateTime

    type Query {
      posts(at: DateTime): Post
    }

    type Post {
      id: ID!
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
