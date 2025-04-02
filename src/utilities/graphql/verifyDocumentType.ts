import type {
  DefinitionNode,
  DocumentNode,
  OperationDefinitionNode,
  VariableDefinitionNode,
} from "graphql";
import { OperationTypeNode } from "graphql";

import {
  AutoCleanedWeakCache,
  cacheSizes,
  defaultCacheSizes,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { registerGlobalCache } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

export enum DocumentType {
  Query,
  Mutation,
  Subscription,
}

export interface IDocumentDefinition {
  type: OperationTypeNode;
  name: string;
  variables: ReadonlyArray<VariableDefinitionNode>;
}

let cache:
  | undefined
  | AutoCleanedWeakCache<
      DocumentNode,
      {
        name: string;
        type: OperationTypeNode;
        variables: readonly VariableDefinitionNode[];
      }
    >;

// This parser is mostly used to safety check incoming documents.
function parser(document: DocumentNode): IDocumentDefinition {
  if (!cache) {
    cache = new AutoCleanedWeakCache(
      cacheSizes.parser || defaultCacheSizes.parser
    );
  }
  const cached = cache.get(document);
  if (cached) return cached;

  let variables, type, name;

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

  type =
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

  const definition = definitions[0] as OperationDefinitionNode;
  variables = definition.variableDefinitions || [];

  if (definition.name && definition.name.kind === "Name") {
    name = definition.name.value;
  } else {
    name = "data"; // fallback to using data if no name
  }

  const payload = { name, type, variables };
  cache.set(document, payload);
  return payload;
}

parser.resetCache = () => {
  cache = undefined;
};

if (__DEV__) {
  registerGlobalCache("parser", () => (cache ? cache.size : 0));
}

export function verifyDocumentType(
  document: DocumentNode,
  type: OperationTypeNode
) {
  const operation = parser(document);
  invariant(
    operation.type === type,
    `Running a %s requires a graphql ` + `%s, but a %s was used instead.`,
    type,
    type,
    operation.type
  );
}
