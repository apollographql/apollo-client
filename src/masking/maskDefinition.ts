import type { FragmentDefinitionNode, SelectionSetNode } from "graphql";
import { Kind } from "graphql";


import type { ApolloCache } from "@apollo/client/cache";
import type { FragmentMap } from "@apollo/client/utilities";
import {
  getFragmentMaskMode,
  maybeDeepFreeze,
  resultKeyNameFromField,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

import { disableWarningsSlot } from "./utils.js";

interface MaskingContext {
  operationType: "query" | "mutation" | "subscription" | "fragment";
  operationName: string | undefined;
  fragmentMap: FragmentMap;
  cache: ApolloCache<unknown>;
  mutableTargets: WeakMap<any, any>;
  knownChanged: WeakSet<any>;
}

export function maskDefinition(
  data: Record<string, any>,
  selectionSet: SelectionSetNode,
  context: MaskingContext
) {
  return disableWarningsSlot.withValue(true, () => {
    const masked = maskSelectionSet(data, selectionSet, context, false);

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
  const memo = getMutableTarget(data, context.mutableTargets);

  if (Array.isArray(data)) {
    for (const [index, item] of Array.from(data.entries())) {
      if (item === null) {
        memo[index] = null;
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
        knownChanged.add(memo);
      }

      memo[index] = masked;
    }

    return knownChanged.has(memo) ? memo : data;
  }

  for (const selection of selectionSet.selections) {
    let value: any;

    // we later want to add acessor warnings to the final result
    // so we need a new object to add the accessor warning to
    if (migration) {
      knownChanged.add(memo);
    }

    if (selection.kind === Kind.FIELD) {
      const keyName = resultKeyNameFromField(selection);
      const childSelectionSet = selection.selectionSet;

      value = memo[keyName] || data[keyName];

      if (value === void 0) {
        continue;
      }

      if (childSelectionSet && value !== null) {
        const masked = maskSelectionSet(
          data[keyName],
          childSelectionSet,
          context,
          migration,
          __DEV__ ? `${path || ""}.${keyName}` : void 0
        );

        if (knownChanged.has(masked)) {
          value = masked;
        }
      }

      if (!__DEV__) {
        memo[keyName] = value;
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
              value,
              path || "",
              context.operationName,
              context.operationType
            )
          );
        } else {
          delete memo[keyName];
          memo[keyName] = value;
        }
      }
    }

    if (
      selection.kind === Kind.INLINE_FRAGMENT &&
      (!selection.typeCondition ||
        context.cache.fragmentMatches!(selection, data.__typename))
    ) {
      value = maskSelectionSet(
        data,
        selection.selectionSet,
        context,
        migration,
        path
      );
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value;
      const fragment: FragmentDefinitionNode | null =
        context.fragmentMap[fragmentName] ||
        (context.fragmentMap[fragmentName] =
          context.cache.lookupFragment(fragmentName)!);
      invariant(
        fragment,
        "Could not find fragment with name '%s'.",
        fragmentName
      );

      const mode = getFragmentMaskMode(selection);

      if (mode !== "mask") {
        value = maskSelectionSet(
          data,
          fragment.selectionSet,
          context,
          mode === "migrate",
          path
        );
      }
    }

    if (knownChanged.has(value)) {
      knownChanged.add(memo);
    }
  }

  if ("__typename" in data && !("__typename" in memo)) {
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
    set(newValue) {
      getValue = () => newValue;
    },
    enumerable: true,
    configurable: true,
  };
}
