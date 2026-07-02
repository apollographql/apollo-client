import { codegen } from "@graphql-codegen/core";
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

  const output = await codegen({
    filename: "input-objects.ts",
    documents: [],
    plugins: [{ "@apollo/client-graphql-codegen/input-objects": {} }],
    schema,
    pluginMap: {
      "@apollo/client-graphql-codegen/input-objects": {
        plugin,
      },
    },
    config: {},
  });

  expect(output).toMatchInlineSnapshot(`""`);
});
