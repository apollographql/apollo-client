import { codegen } from "@graphql-codegen/core";
import type { Types } from "@graphql-codegen/plugin-helpers";
import { gql } from "graphql-tag";

import * as scalarTypePoliciesPlugin from "../plugin.js";

test("works", async () => {
  const schema = gql`
    scalar DateTime

    type Query {
      event(at: DateTime): Event
    }

    type Event {
      id: ID!
    }
  `;

  await expect(runCodegen({ schema })).resolves.toStrictEqual("");
});

async function runCodegen(
  options: Partial<Omit<Types.GenerateOptions, "schema">> &
    Pick<Types.GenerateOptions, "schema">
) {
  return await codegen({
    filename: "input-objects.ts",
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
