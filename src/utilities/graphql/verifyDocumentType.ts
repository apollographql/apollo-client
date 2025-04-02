import type { DefinitionNode, DocumentNode } from "graphql";
import { OperationTypeNode } from "graphql";

import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

export function verifyDocumentType(
  document: DocumentNode,
  expectedType: OperationTypeNode
) {
  invariant(
    !!document && !!document.kind,
    `Argument of %s passed to parser was not a valid GraphQL ` +
      `DocumentNode. You may need to use 'graphql-tag' or another method ` +
      `to convert your operation into a document`,
    document
  );

  const fragments: DefinitionNode[] = [];
  const queries: DefinitionNode[] = [];
  const mutations: DefinitionNode[] = [];
  const subscriptions: DefinitionNode[] = [];

  for (const x of document.definitions) {
    if (x.kind === "FragmentDefinition") {
      fragments.push(x);
      continue;
    }

    if (x.kind === "OperationDefinition") {
      switch (x.operation) {
        case "query":
          queries.push(x);
          break;
        case "mutation":
          mutations.push(x);
          break;
        case "subscription":
          subscriptions.push(x);
          break;
      }
    }
  }

  invariant(
    !fragments.length ||
      queries.length ||
      mutations.length ||
      subscriptions.length,
    `Passing only a fragment to 'graphql' is not yet supported. ` +
      `You must include a query, subscription or mutation as well`
  );

  invariant(
    queries.length + mutations.length + subscriptions.length <= 1,
    `react-apollo only supports a query, subscription, or a mutation per HOC. ` +
      `%s had %s queries, %s ` +
      `subscriptions and %s mutations. ` +
      `You can use 'compose' to join multiple operation types to a component`,
    document,
    queries.length,
    subscriptions.length,
    mutations.length
  );

  const type =
    queries.length ? OperationTypeNode.QUERY
    : mutations.length ? OperationTypeNode.MUTATION
    : OperationTypeNode.SUBSCRIPTION;

  const definitions =
    queries.length ? queries
    : mutations.length ? mutations
    : subscriptions;

  invariant(
    definitions.length === 1,
    `react-apollo only supports one definition per HOC. %s had ` +
      `%s definitions. ` +
      `You can use 'compose' to join multiple operation types to a component`,
    document,
    definitions.length
  );

  invariant(
    type === expectedType,
    `Running a %s requires a graphql ` + `%s, but a %s was used instead.`,
    expectedType,
    expectedType,
    type
  );
}
