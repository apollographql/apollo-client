import type { OperationDefinitionNode } from "graphql";
import { Kind } from "graphql";

import {
  disableFragmentWarnings,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { getFragmentQueryDocument } from "@apollo/client/utilities/internal";

disableFragmentWarnings();
enableExperimentalFragmentVariables();

test("does not pass arguments to the root fragment spread for fragment variables", () => {
  const document = getFragmentQueryDocument(gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `);

  expect(document).toMatchDocument(gql`
    {
      ...UserCard @_apollo(fragmentRoot: true)
    }

    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `);

  const operation = document.definitions[0] as OperationDefinitionNode;

  expect(operation.selectionSet.selections).toStrictEqual([
    {
      kind: Kind.FRAGMENT_SPREAD,
      name: { kind: Kind.NAME, value: "UserCard" },
      directives: [
        {
          kind: Kind.DIRECTIVE,
          name: { kind: Kind.NAME, value: "_apollo" },
          arguments: [
            {
              kind: Kind.ARGUMENT,
              name: { kind: Kind.NAME, value: "fragmentRoot" },
              value: { kind: Kind.BOOLEAN, value: true },
            },
          ],
        },
      ],
    },
  ]);
});
