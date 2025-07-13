import type {
  ApolloCache,
  DocumentNode,
  TypedDocumentNode,
} from "../core/index.js";
import { invariant } from "../utilities/globals/index.js";
import {
  createFragmentMap,
  getFragmentDefinitions,
  getOperationDefinition,
} from "../utilities/index.js";
import { maskDefinition } from "./maskDefinition.js";
import {
  MapImpl,
  SetImpl,
  warnOnImproperCacheImplementation,
} from "./utils.js";

/** @internal */
export function maskOperation<TData = unknown>(
  data: TData,
  document: DocumentNode | TypedDocumentNode<TData>,
  cache: ApolloCache<unknown>
): TData {
  if (!cache.fragmentMatches) {
    if (__DEV__) {
      warnOnImproperCacheImplementation();
    }

    return data;
  }

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
    mutableTargets: new MapImpl(),
    knownChanged: new SetImpl(),
  });
}
