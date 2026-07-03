import { codegen } from "@graphql-codegen/core";
import type { Types } from "@graphql-codegen/plugin-helpers";
import { gql } from "graphql-tag";

import * as scalarTypePoliciesPlugin from "../plugin.js";

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
