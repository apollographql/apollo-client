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
  getOperationName,
  getFragmentMaskMode,
  getOperationDefinition,
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
  operationName: string | null;
  fragmentMap: FragmentMap;
  matchesFragment: MatchesFragmentFn;
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
    operationName: getOperationName(document),
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    matchesFragment,
  };

  const [masked, changed] = maskSelectionSet(
    data,
    definition.selectionSet,
    [],
    context
  );

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

  const context: MaskingContext = {
    operationType: "fragment",
    operationName: null,
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    matchesFragment,
  };

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

  const [masked, changed] = maskSelectionSet(
    data,
    fragment.selectionSet,
    [],
    context
  );

  return changed ? masked : data;
}

function maskSelectionSet(
  data: any,
  selectionSet: SelectionSetNode,
  path: PathSelection,
  context: MaskingContext
): [data: any, changed: boolean] {
  if (Array.isArray(data)) {
    let changed = false;

    const masked = data.map((item, index) => {
      const [masked, itemChanged] = maskSelectionSet(
        item,
        selectionSet,
        [...path, index],
        context
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
              [...path, keyName],
              context
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
            path,
            context
          );

          return [
            {
              ...memo,
              ...fragmentData,
            },
            changed || childChanged,
          ];
        }
        case Kind.FRAGMENT_SPREAD:
          const fragment = context.fragmentMap[selection.name.value];
          const mode = getFragmentMaskMode(selection);

          if (mode === "mask") {
            return [memo, true];
          }

          if (mode === "unmask") {
            const [fragmentData, changed] = maskSelectionSet(
              data,
              fragment.selectionSet,
              path,
              context
            );

            return [{ ...memo, ...fragmentData }, changed];
          }

          return [
            unmaskFragmentFields(
              memo,
              data,
              fragment.selectionSet,
              path,
              mode,
              context
            ),
            true,
          ];
      }
    },
    [Object.create(null), false]
  );
}

function unmaskFragmentFields(
  memo: Record<string, unknown>,
  parent: Record<string, unknown>,
  selectionSetNode: SelectionSetNode,
  path: PathSelection,
  mode: "unmask" | "migrate",
  context: MaskingContext
) {
  if (Array.isArray(parent)) {
    return parent.map((item, index): unknown => {
      return unmaskFragmentFields(
        memo[index] ?? Object.create(null),
        item,
        selectionSetNode,
        [...path, index],
        mode,
        context
      );
    });
  }

  selectionSetNode.selections.forEach((selection) => {
    switch (selection.kind) {
      case Kind.FIELD: {
        const keyName = resultKeyNameFromField(selection);
        const childSelectionSet = selection.selectionSet;

        if (keyName in memo) {
          return;
        }

        if (mode === "migrate") {
          let value = parent[keyName];

          if (childSelectionSet) {
            value = unmaskFragmentFields(
              memo[keyName] ?? Object.create(null),
              parent[keyName] as Record<string, unknown>,
              childSelectionSet,
              [...path, keyName],
              mode,
              context
            );
          }

          if (__DEV__) {
            addAccessorWarning(memo, value, keyName, path, context);
          }

          if (!__DEV__) {
            memo[keyName] = parent[keyName];
          }
        } else {
          memo[keyName] = parent[keyName];
        }

        return;
      }
      case Kind.INLINE_FRAGMENT: {
        return unmaskFragmentFields(
          memo,
          parent,
          selection.selectionSet,
          path,
          mode,
          context
        );
      }
      case Kind.FRAGMENT_SPREAD: {
        return unmaskFragmentFields(
          memo,
          parent,
          context.fragmentMap[selection.name.value].selectionSet,
          path,
          mode,
          context
        );
      }
    }
  });

  return memo;
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
