import type {
  ApolloCache,
  DocumentNode,
  TypedDocumentNode,
} from "@apollo/client";
import { __DEV__ } from "@apollo/client/utilities/environment";
import {
  createFragmentMap,
  getFragmentDefinitions,
  getOperationDefinition,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { maskDefinition } from "./maskDefinition.js";

/** @internal */
export function maskOperation<TData = unknown>(
  data: TData,
  document: DocumentNode | TypedDocumentNode<TData>,
  cache: ApolloCache
): TData {
  const definition = getOperationDefinition(document);

  invariant(
    definition,
    "Expected a parsed GraphQL document with a query, mutation, or subscription."
  );

  if (data == null) {
    // Maintain the original `null` or `undefined` value
    return data;
  }

  return maskDefinition(data, definition.selectionSet, {
    operationType: definition.operation,
    operationName: definition.name?.value,
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    cache,
    mutableTargets: new WeakMap(),
    knownChanged: new WeakSet(),
  });
}
