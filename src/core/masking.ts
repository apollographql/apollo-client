import { Kind } from "graphql";
import type {
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionSetNode,
} from "graphql";
import {
  createFragmentMap,
  resultKeyNameFromField,
  getFragmentDefinitions,
  getFragmentMaskMode,
  getOperationDefinition,
  maybeDeepFreeze,
} from "../utilities/index.js";
import type { FragmentMap } from "../utilities/index.js";
import type { DocumentNode, TypedDocumentNode } from "./index.js";
import { invariant } from "../utilities/globals/index.js";

type MatchesFragmentFn = (
  fragmentNode: InlineFragmentNode,
  typename: string
) => boolean;

interface MaskingContext {
  operationType: "query" | "mutation" | "subscription" | "fragment";
  operationName: string | undefined;
  fragmentMap: FragmentMap;
  matchesFragment: MatchesFragmentFn;
  disableWarnings?: boolean;
}

type PathSelection = Array<string | number>;

export function maskOperation<TData = unknown>(
  data: TData,
  document: TypedDocumentNode<TData> | DocumentNode,
  matchesFragment: MatchesFragmentFn
): TData {
  const definition = getOperationDefinition(document);

  invariant(
    definition,
    "Expected a parsed GraphQL document with a query, mutation, or subscription."
  );

  const context: MaskingContext = {
    operationType: definition.operation,
    operationName: definition.name?.value,
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    matchesFragment,
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
  matchesFragment: MatchesFragmentFn,
  fragmentName?: string
): TData {
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

  const context: MaskingContext = {
    operationType: "fragment",
    operationName: fragment.name.value,
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    matchesFragment,
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
  path: PathSelection = []
): [data: any, changed: boolean] {
  if (Array.isArray(data)) {
    let changed = false;

    const masked = data.map((item, index) => {
      const [masked, itemChanged] = maskSelectionSet(
        item,
        selectionSet,
        context,
        [...path, index]
      );
      changed ||= itemChanged;

      return itemChanged ? masked : item;
    });

    return [changed ? masked : data, changed];
  }

  return selectionSet.selections.reduce<[any, boolean]>(
    ([memo, changed], selection) => {
      switch (selection.kind) {
        case Kind.FIELD: {
          const keyName = resultKeyNameFromField(selection);
          const descriptor = Object.getOwnPropertyDescriptor(memo, keyName);
          const childSelectionSet = selection.selectionSet;

          // If we've set a descriptor on the object by adding warnings to field
          // access, overwrite the descriptor because we're adding a field that
          // is accessible when masked. This avoids the need for us to maintain
          // which fields are masked/unmasked and avoids dependence on field
          // order.
          if (descriptor) {
            delete memo[keyName];
          }

          memo[keyName] = data[keyName];

          if (childSelectionSet) {
            const [masked, childChanged] = maskSelectionSet(
              data[keyName],
              childSelectionSet,
              context,
              [...path, keyName]
            );

            if (childChanged) {
              memo[keyName] = masked;
              changed = true;
            }
          }

          return [memo, changed];
        }
        case Kind.INLINE_FRAGMENT: {
          if (
            selection.typeCondition &&
            !context.matchesFragment(selection, data.__typename)
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
          const fragment = context.fragmentMap[selection.name.value];
          const mode = getFragmentMaskMode(selection);

          if (mode === "mask") {
            return [memo, true];
          }

          if (mode === "unmask") {
            const [fragmentData, changed] = maskSelectionSet(
              data,
              fragment.selectionSet,
              context,
              path
            );

            return [{ ...memo, ...fragmentData }, changed];
          }

          return [
            addFieldAccessorWarnings(
              memo,
              data,
              fragment.selectionSet,
              path,
              context
            ),
            true,
          ];
        }
      }
    },
    [Object.create(null), false]
  );
}

function addFieldAccessorWarnings(
  memo: Record<string, unknown>,
  data: Record<string, unknown>,
  selectionSetNode: SelectionSetNode,
  path: PathSelection,
  context: MaskingContext
) {
  if (Array.isArray(data)) {
    return data.map((item, index): unknown => {
      return addFieldAccessorWarnings(
        memo[index] ?? Object.create(null),
        item,
        selectionSetNode,
        [...path, index],
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
            memo[keyName] ?? Object.create(null),
            data[keyName] as Record<string, unknown>,
            childSelectionSet,
            [...path, keyName],
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
  path: PathSelection,
  context: MaskingContext
) {
  let currentValue = value;
  let warned = false;

  Object.defineProperty(data, fieldName, {
    get() {
      if (context.disableWarnings) {
        return currentValue;
      }

      if (!warned) {
        invariant.warn(
          "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
          context.operationName ?
            `${context.operationType} '${context.operationName}'`
          : `anonymous ${context.operationType}`,
          getPathString([...path, fieldName])
        );
        warned = true;
      }

      return currentValue;
    },
    set(value) {
      currentValue = value;
    },
    enumerable: true,
    configurable: true,
  });
}

function getPathString(path: PathSelection) {
  return path.reduce<string>((memo, segment, index) => {
    if (typeof segment === "number") {
      return `${memo}[${segment}]`;
    }

    return index === 0 ? segment : `${memo}.${segment}`;
  }, "");
}
