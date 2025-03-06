import { __DEV__ } from "@apollo/client/utilities/environment";
import { Kind } from "graphql";
import type { FragmentDefinitionNode } from "graphql";
import type {
  ApolloCache,
  DocumentNode,
  TypedDocumentNode,
} from "@apollo/client/core";
import {
  MapImpl,
  SetImpl,
  warnOnImproperCacheImplementation,
} from "./utils.js";
import { invariant } from "@apollo/client/utilities/invariant";
import equal from "@wry/equality";
import { maskDefinition } from "./maskDefinition.js";
import {
  createFragmentMap,
  getFragmentDefinitions,
} from "@apollo/client/utilities";

/** @internal */
export function maskFragment<TData = unknown>(
  data: TData,
  document: TypedDocumentNode<TData> | DocumentNode,
  cache: ApolloCache<unknown>,
  fragmentName?: string
): TData {
  if (!cache.fragmentMatches) {
    if (__DEV__) {
      warnOnImproperCacheImplementation();
    }

    return data;
  }

  const fragments = document.definitions.filter(
    (node): node is FragmentDefinitionNode =>
      node.kind === Kind.FRAGMENT_DEFINITION
  );

  if (typeof fragmentName === "undefined") {
    invariant(
      fragments.length === 1,
      `Found %s fragments. \`fragmentName\` must be provided when there is not exactly 1 fragment.`,
      fragments.length
    );
    fragmentName = fragments[0].name.value;
  }

  const fragment = fragments.find(
    (fragment) => fragment.name.value === fragmentName
  );

  invariant(
    !!fragment,
    `Could not find fragment with name "%s".`,
    fragmentName
  );

  if (data == null) {
    // Maintain the original `null` or `undefined` value
    return data;
  }

  if (equal(data, {})) {
    // Return early and skip the masking algorithm if we don't have any data
    // yet. This can happen when cache.diff returns an empty object which is
    // used from watchFragment.
    return data;
  }

  return maskDefinition(data, fragment.selectionSet, {
    operationType: "fragment",
    operationName: fragment.name.value,
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    cache,
    mutableTargets: new MapImpl(),
    knownChanged: new SetImpl(),
  });
}
