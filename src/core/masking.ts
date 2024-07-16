import { Kind } from "graphql";
import type {
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionSetNode,
} from "graphql";
import {
  createFragmentMap,
  getMainDefinition,
  resultKeyNameFromField,
  isUnmaskedDocument,
  getFragmentDefinitions,
  getOperationName,
} from "../utilities/index.js";
import type { FragmentMap } from "../utilities/index.js";
import type { DocumentNode, TypedDocumentNode } from "./index.js";
import { invariant } from "../utilities/globals/index.js";

type MatchesFragmentFn = (
  fragmentNode: InlineFragmentNode,
  typename: string
) => boolean;

interface MaskingContext {
  operationName: string | null;
  fragmentMap: FragmentMap;
  warnOnFieldAccess: boolean;
  unmasked: boolean;
}

export function maskQuery<TData = unknown>(
  data: TData,
  document: TypedDocumentNode<TData> | DocumentNode,
  matchesFragment: MatchesFragmentFn
): TData {
  const definition = getMainDefinition(document);
  const [unmasked, { warnOnFieldAccess }] = isUnmaskedDocument(document);

  const context: MaskingContext = {
    operationName: getOperationName(document),
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    warnOnFieldAccess,
    unmasked,
  };

  const [masked, changed] = maskSelectionSet(
    data,
    definition.selectionSet,
    matchesFragment,
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
    operationName: null,
    fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
    warnOnFieldAccess: true,
    unmasked: false,
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
    matchesFragment,
    context
  );

  return changed ? masked : data;
}

function maskSelectionSet(
  data: any,
  selectionSet: SelectionSetNode,
  matchesFragment: MatchesFragmentFn,
  context: MaskingContext
): [data: any, changed: boolean] {
  if (Array.isArray(data)) {
    let changed = false;

    const masked = data.map((item) => {
      const [masked, itemChanged] = maskSelectionSet(
        item,
        selectionSet,
        matchesFragment,
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
              matchesFragment,
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
            !matchesFragment(selection, data.__typename)
          ) {
            return [memo, changed];
          }

          const [fragmentData, childChanged] = maskSelectionSet(
            data,
            selection.selectionSet,
            matchesFragment,
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
        default:
          const fragment = context.fragmentMap[selection.name.value];

          return [
            context.unmasked ?
              addAccessorWarnings(memo, data, fragment.selectionSet, context)
            : memo,
            true,
          ];
      }
    },
    [Object.create(null), false]
  );
}

function addAccessorWarnings(
  memo: Record<string, unknown>,
  parent: Record<string, unknown>,
  selectionSetNode: SelectionSetNode,
  context: MaskingContext
) {
  selectionSetNode.selections.forEach((selection) => {
    switch (selection.kind) {
      case Kind.FIELD: {
        const keyName = resultKeyNameFromField(selection);

        if (keyName in memo) {
          return;
        }

        if (context.warnOnFieldAccess) {
          return addAccessorWarning(
            memo,
            parent[keyName],
            keyName,
            context.operationName
          );
        } else {
          memo[keyName] = parent[keyName];
        }
      }
    }
  });

  return memo;
}

function addAccessorWarning(
  data: Record<string, any>,
  value: any,
  fieldName: string,
  operationName: string | null
) {
  let currentValue = value;
  let warned = false;

  Object.defineProperty(data, fieldName, {
    get() {
      if (!warned) {
        invariant.warn(
          "Accessing unmasked field '%s' on %s. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
          fieldName,
          operationName ? `query '${operationName}'` : "anonymous query"
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
