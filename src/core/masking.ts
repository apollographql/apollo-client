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
  migration: WeakMap<
    any,
    {
      path: string;
      unmasked: Set<string>;
      migrated: Set<string>;
    }
  >;
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
    migration: new MapImpl(),
  };

  const [masked, changed] = maskSelectionSet(
    data,
    definition.selectionSet,
    context,
    undefined,
    false
  );

  if (__DEV__) {
    addMigrationWarnings(context, masked);
  }

  if (Object.isFrozen(data)) {
    disableWarningsSlot.withValue(true, maybeDeepFreeze, [masked]);
  }

  return changed ? masked : data;
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
    migration: new MapImpl(),
  };

  const [masked, changed] = maskSelectionSet(
    data,
    fragment.selectionSet,
    context,
    undefined,
    false
  );

  if (__DEV__) {
    addMigrationWarnings(context, masked);
  }

  if (Object.isFrozen(data)) {
    disableWarningsSlot.withValue(true, maybeDeepFreeze, [masked]);
  }

  return changed ? masked : data;
}

function getMutableTarget(
  data: Record<string, any>,
  context: MaskingContext
): typeof data {
  if (context.mutableTargets.has(data)) {
    return context.mutableTargets.get(data);
  }

  const mutableTarget = Array.isArray(data) ? [] : Object.create(null);
  context.mutableTargets.set(data, mutableTarget);
  return mutableTarget;
}

function maskSelectionSet(
  data: any,
  selectionSet: SelectionSetNode,
  context: MaskingContext,
  path: string | undefined,
  migration: boolean
): [data: any, changed: boolean] {
  if (Array.isArray(data)) {
    let changed = false;
    const target = getMutableTarget(data, context);
    for (const [index, item] of Array.from(data.entries())) {
      if (item === null) {
        target[index] = null;
        continue;
      }

      const [masked, itemChanged] = maskSelectionSet(
        item,
        selectionSet,
        context,
        __DEV__ ? `${path || ""}[${index}]` : void 0,
        migration
      );
      changed ||= itemChanged;

      target[index] = masked;
    }

    return [changed ? target : data, changed];
  }

  let changed = false;
  const memo = getMutableTarget(data, context);
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        const keyName = resultKeyNameFromField(selection);
        const childSelectionSet = selection.selectionSet;

        let newValue = memo[keyName] || data[keyName];
        if (keyName in data && childSelectionSet && data[keyName] !== null) {
          const [masked, childChanged] = maskSelectionSet(
            data[keyName],
            childSelectionSet,
            context,
            __DEV__ ? `${path || ""}.${keyName}` : void 0,
            migration
          );

          if (childChanged) {
            newValue = masked;
            changed = true;
          }
        }

        if (newValue !== void 0) {
          memo[keyName] = newValue;
        }
        if (__DEV__) {
          const m = context.migration;
          if (!m.has(memo)) {
            m.set(memo, {
              path: path || "",
              unmasked: new Set(),
              migrated: new Set(),
            });
          }
          m.get(memo)![migration ? "migrated" : "unmasked"].add(keyName);
        }
        // we later want to add acessor warnings to the final result
        // so we need a new object to add the accessor warning to
        changed ||= migration;
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          selection.typeCondition &&
          !context.cache.fragmentMatches!(selection, data.__typename)
        ) {
          break;
        }

        const [, childChanged] = maskSelectionSet(
          data,
          selection.selectionSet,
          context,
          path,
          migration
        );
        changed ||= childChanged;
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

        const [, selectionChanged] = maskSelectionSet(
          data,
          fragment.selectionSet,
          context,
          path,
          mode === "migrate"
        );

        changed ||= selectionChanged;
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
  changed ||= Object.keys(memo).length !== Object.keys(data).length;

  // If the object has been changed in another subtree, but not in this,
  // we still have to return "changed" as true, as otherwise a call parent
  // would use original data instead of the masked one.
  if (changed) {
    context.knownChanged.add(memo);
  } else {
    changed ||= context.knownChanged.has(memo);
  }

  return [changed ? memo : data, changed];
}

function addMigrationWarnings(context: MaskingContext, masked: any) {
  JSON.stringify(masked, function (this: any, key, value) {
    const obj = context.migration.get(this);
    if (obj && obj.migrated.has(key) && !obj.unmasked.has(key)) {
      // In order to preserve the original shape of the data as much as possible, we
      // want to skip adding a property with warning to the final result when the
      // value is missing, otherwise our final result will contain additional
      // properties that our original result did not have. This could happen with a
      // deferred payload for example.
      if (value !== void 0) {
        Object.defineProperty(
          this,
          key,
          getAccessorWarningDescriptor(
            value,
            key,
            obj.path,
            context.operationName,
            context.operationType
          )
        );
      }
    }
    return value;
  });
}

function getAccessorWarningDescriptor(
  value: any,
  fieldName: string,
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
