import { Kind } from "graphql";
import type { FragmentDefinitionNode, SelectionSetNode } from "graphql";
import {
  createFragmentMap,
  resultKeyNameFromField,
  getFragmentDefinitions,
  getFragmentMaskMode,
  getOperationDefinition,
  maybeDeepFreeze,
  canUseWeakMap,
  canUseWeakSet,
} from "../utilities/index.js";
import type { FragmentMap } from "../utilities/index.js";
import type { ApolloCache, DocumentNode, TypedDocumentNode } from "./index.js";
import { invariant } from "../utilities/globals/index.js";
import { equal } from "@wry/equality";
import { Slot } from "optimism";

interface MaskingContext {
  operationType: "query" | "mutation" | "subscription" | "fragment";
  operationName: string | undefined;
  fragmentMap: FragmentMap;
  cache: ApolloCache<unknown>;
  mutableTargets: WeakMap<any, any>;
  knownChanged: WeakSet<any>;
}

const MapImpl = canUseWeakMap ? WeakMap : Map;
const SetImpl = canUseWeakSet ? WeakSet : Set;

// Contextual slot that allows us to disable accessor warnings on fields when in
// migrate mode.
export const disableWarningsSlot = new Slot<boolean>();

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

  const context: MaskingContext = {
    operationType: definition.operation,
    operationName: definition.name?.value,
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    cache,
    mutableTargets: new MapImpl(),
    knownChanged: new SetImpl(),
  };

  return disableWarningsSlot.withValue(true, () => {
    const masked = maskSelectionSet(
      data,
      definition.selectionSet,
      context,
      false
    );

    if (Object.isFrozen(data)) {
      maybeDeepFreeze(masked);
    }
    return masked;
  });
}

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

  const context: MaskingContext = {
    operationType: "fragment",
    operationName: fragment.name.value,
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    cache,
    mutableTargets: new MapImpl(),
    knownChanged: new SetImpl(),
  };

  return disableWarningsSlot.withValue(true, () => {
    const masked = maskSelectionSet(
      data,
      fragment.selectionSet,
      context,
      false
    );

    if (Object.isFrozen(data)) {
      maybeDeepFreeze(masked);
    }
    return masked;
  });
}

function getMutableTarget(
  data: Record<string, any>,
  mutableTargets: WeakMap<any, any>
): typeof data {
  if (mutableTargets.has(data)) {
    return mutableTargets.get(data);
  }

  const mutableTarget = Array.isArray(data) ? [] : Object.create(null);
  mutableTargets.set(data, mutableTarget);
  return mutableTarget;
}

function maskSelectionSet(
  data: any,
  selectionSet: SelectionSetNode,
  context: MaskingContext,
  migration: boolean,
  path?: string | undefined
): typeof data {
  const { knownChanged } = context;

  if (Array.isArray(data)) {
    const target = getMutableTarget(data, context.mutableTargets);
    for (const [index, item] of Array.from(data.entries())) {
      if (item === null) {
        target[index] = null;
        continue;
      }

      const masked = maskSelectionSet(
        item,
        selectionSet,
        context,
        migration,
        __DEV__ ? `${path || ""}[${index}]` : void 0
      );
      if (knownChanged.has(masked)) {
        knownChanged.add(target);
      }

      target[index] = masked;
    }

    return knownChanged.has(target) ? target : data;
  }

  const memo = getMutableTarget(data, context.mutableTargets);
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        // we later want to add acessor warnings to the final result
        // so we need a new object to add the accessor warning to
        if (migration) {
          knownChanged.add(memo);
        }

        const keyName = resultKeyNameFromField(selection);
        const childSelectionSet = selection.selectionSet;

        let newValue = memo[keyName] || data[keyName];

        if (newValue === void 0) {
          break;
        }

        if (childSelectionSet && newValue !== null) {
          const masked = maskSelectionSet(
            data[keyName],
            childSelectionSet,
            context,
            migration,
            __DEV__ ? `${path || ""}.${keyName}` : void 0
          );

          if (knownChanged.has(masked)) {
            newValue = masked;
            knownChanged.add(memo);
          }
        }

        if (!__DEV__) {
          memo[keyName] = newValue;
        }
        if (__DEV__) {
          if (
            migration &&
            keyName !== "__typename" &&
            // either the field is not present in the memo object
            // or it has a `get` descriptor, not a `value` descriptor
            // => it is a warning accessor and we can overwrite it
            // with another accessor
            !Object.getOwnPropertyDescriptor(memo, keyName)?.value
          ) {
            Object.defineProperty(
              memo,
              keyName,
              getAccessorWarningDescriptor(
                keyName,
                newValue,
                path || "",
                context.operationName,
                context.operationType
              )
            );
          } else {
            delete memo[keyName];
            memo[keyName] = newValue;
          }
        }

        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          selection.typeCondition &&
          !context.cache.fragmentMatches!(selection, data.__typename)
        ) {
          break;
        }

        const fragmentData = maskSelectionSet(
          data,
          selection.selectionSet,
          context,
          migration,
          path
        );
        if (knownChanged.has(fragmentData)) {
          knownChanged.add(memo);
        }
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragmentName = selection.name.value;
        let fragment: FragmentDefinitionNode | null =
          context.fragmentMap[fragmentName] ||
          (context.fragmentMap[fragmentName] =
            context.cache.lookupFragment(fragmentName)!);
        invariant(
          fragment,
          "Could not find fragment with name '%s'.",
          fragmentName
        );

        const mode = getFragmentMaskMode(selection);

        if (mode === "mask") {
          break;
        }

        const fragmentData = maskSelectionSet(
          data,
          fragment.selectionSet,
          context,
          mode === "migrate",
          path
        );

        if (knownChanged.has(fragmentData)) {
          knownChanged.add(memo);
        }

        break;
      }
    }
  }

  if (data && "__typename" in data && !("__typename" in memo)) {
    memo.__typename = data.__typename;
  }

  // This check prevents cases where masked fields may accidentally be
  // returned as part of this object when the fragment also selects
  // additional fields from the same child selection.
  if (Object.keys(memo).length !== Object.keys(data).length) {
    knownChanged.add(memo);
  }

  return knownChanged.has(memo) ? memo : data;
}

function getAccessorWarningDescriptor(
  fieldName: string,
  value: any,
  path: string,
  operationName: string | undefined,
  operationType: string
): PropertyDescriptor {
  let getValue = () => {
    if (disableWarningsSlot.getValue()) {
      return value;
    }

    invariant.warn(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      operationName ?
        `${operationType} '${operationName}'`
      : `anonymous ${operationType}`,
      `${path}.${fieldName}`.replace(/^\./, "")
    );

    getValue = () => value;

    return value;
  };

  return {
    get() {
      return getValue();
    },
    set(v) {
      value = v;
      getValue = () => value;
    },
    enumerable: true,
    configurable: true,
  };
}

let issuedWarning = false;
function warnOnImproperCacheImplementation() {
  if (!issuedWarning) {
    issuedWarning = true;
    invariant.warn(
      "The configured cache does not support data masking which effectively disables it. Please use a cache that supports data masking or disable data masking to silence this warning."
    );
  }
}
