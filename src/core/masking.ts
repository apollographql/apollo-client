import { Kind } from "graphql";
import type { FragmentDefinitionNode, SelectionSetNode } from "graphql";
import {
  createFragmentMap,
  resultKeyNameFromField,
  getFragmentDefinitions,
  getFragmentMaskMode,
  getOperationDefinition,
  maybeDeepFreeze,
} from "../utilities/index.js";
import type { FragmentMap } from "../utilities/index.js";
import type { ApolloCache, DocumentNode, TypedDocumentNode } from "./index.js";
import { invariant } from "../utilities/globals/index.js";

interface MaskingContext {
  operationType: "query" | "mutation" | "subscription" | "fragment";
  operationName: string | undefined;
  fragmentMap: FragmentMap;
  cache: ApolloCache<unknown>;
  disableWarnings?: boolean;
}

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
  };

  const [masked, changed] = maskSelectionSet(
    data,
    definition.selectionSet,
    context
  );

  if (Object.isFrozen(data)) {
    context.disableWarnings = true;
    maybeDeepFreeze(masked);
    context.disableWarnings = false;
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

  const context: MaskingContext = {
    operationType: "fragment",
    operationName: fragment.name.value,
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    cache,
  };

  const [masked, changed] = maskSelectionSet(
    data,
    fragment.selectionSet,
    context
  );

  if (Object.isFrozen(data)) {
    context.disableWarnings = true;
    maybeDeepFreeze(masked);
    context.disableWarnings = false;
  }

  return changed ? masked : data;
}

function maskSelectionSet(
  data: any,
  selectionSet: SelectionSetNode,
  context: MaskingContext,
  path?: string | undefined
): [data: any, changed: boolean] {
  if (Array.isArray(data)) {
    let changed = false;

    const masked = data.map((item, index) => {
      if (item === null) {
        return null;
      }

      const [masked, itemChanged] = maskSelectionSet(
        item,
        selectionSet,
        context,
        __DEV__ ? `${path || ""}[${index}]` : void 0
      );
      changed ||= itemChanged;

      return itemChanged ? masked : item;
    });

    return [changed ? masked : data, changed];
  }

  const result = selectionSet.selections.reduce<[any, boolean]>(
    ([memo, changed], selection) => {
      switch (selection.kind) {
        case Kind.FIELD: {
          const keyName = resultKeyNameFromField(selection);
          const childSelectionSet = selection.selectionSet;

          memo[keyName] = data[keyName];

          if (childSelectionSet && data[keyName] !== null) {
            const [masked, childChanged] = maskSelectionSet(
              data[keyName],
              childSelectionSet,
              context,
              __DEV__ ? `${path || ""}.${keyName}` : void 0
            );

            if (
              childChanged ||
              // This check prevents cases where masked fields may accidentally be
              // returned as part of this object when the fragment also selects
              // additional fields from the same child selection.
              Object.keys(masked).length !== Object.keys(data[keyName]).length
            ) {
              memo[keyName] = masked;
              changed = true;
            }
          }

          return [memo, changed];
        }
        case Kind.INLINE_FRAGMENT: {
          if (
            selection.typeCondition &&
            !context.cache.fragmentMatches!(selection, data.__typename)
          ) {
            return [memo, changed];
          }

          const [fragmentData, childChanged] = maskSelectionSet(
            data,
            selection.selectionSet,
            context,
            path
          );

          return [
            {
              ...memo,
              ...fragmentData,
            },
            changed || childChanged,
          ];
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
            return [memo, true];
          }

          if (__DEV__) {
            if (mode === "migrate") {
              return [
                addFieldAccessorWarnings(
                  memo,
                  data,
                  fragment.selectionSet,
                  path || "",
                  context
                ),
                true,
              ];
            }
          }

          const [fragmentData, changed] = maskSelectionSet(
            data,
            fragment.selectionSet,
            context,
            path
          );

          return [{ ...memo, ...fragmentData }, changed];
        }
      }
    },
    [Object.create(null), false]
  );

  if ("__typename" in data && !("__typename" in result[0])) {
    result[0].__typename = data.__typename;
  }

  return result;
}

function addFieldAccessorWarnings(
  memo: Record<string, unknown>,
  data: Record<string, unknown>,
  selectionSetNode: SelectionSetNode,
  path: string,
  context: MaskingContext
) {
  if (Array.isArray(data)) {
    return data.map((item, index): unknown => {
      return addFieldAccessorWarnings(
        memo[index] || Object.create(null),
        item,
        selectionSetNode,
        `${path}[${index}]`,
        context
      );
    });
  }

  return selectionSetNode.selections.reduce<any>((memo, selection) => {
    switch (selection.kind) {
      case Kind.FIELD: {
        const keyName = resultKeyNameFromField(selection);
        const childSelectionSet = selection.selectionSet;

        if (keyName in memo) {
          return memo;
        }

        let value = data[keyName];

        if (childSelectionSet) {
          value = addFieldAccessorWarnings(
            memo[keyName] || Object.create(null),
            data[keyName] as Record<string, unknown>,
            childSelectionSet,
            `${path}.${keyName}`,
            context
          );
        }

        if (__DEV__) {
          addAccessorWarning(memo, value, keyName, path, context);
        }

        if (!__DEV__) {
          memo[keyName] = data[keyName];
        }

        return memo;
      }
      case Kind.INLINE_FRAGMENT: {
        return addFieldAccessorWarnings(
          memo,
          data,
          selection.selectionSet,
          path,
          context
        );
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragment = context.fragmentMap[selection.name.value];
        const mode = getFragmentMaskMode(selection);

        if (mode === "mask") {
          return memo;
        }

        if (mode === "unmask") {
          const [fragmentData] = maskSelectionSet(
            data,
            fragment.selectionSet,
            context,
            path
          );

          return Object.assign(memo, fragmentData);
        }

        return addFieldAccessorWarnings(
          memo,
          data,
          fragment.selectionSet,
          path,
          context
        );
      }
    }
  }, memo);
}

function addAccessorWarning(
  data: Record<string, any>,
  value: any,
  fieldName: string,
  path: string,
  context: MaskingContext
) {
  let getValue = () => {
    if (context.disableWarnings) {
      return value;
    }

    invariant.warn(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      context.operationName ?
        `${context.operationType} '${context.operationName}'`
      : `anonymous ${context.operationType}`,
      `${path}.${fieldName}`.replace(/^\./, "")
    );

    getValue = () => value;

    return value;
  };

  Object.defineProperty(data, fieldName, {
    get() {
      return getValue();
    },
    set(value) {
      getValue = () => value;
    },
    enumerable: true,
    configurable: true,
  });
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
