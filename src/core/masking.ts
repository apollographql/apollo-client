import { Kind } from "graphql";
import type {
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionSetNode,
} from "graphql";
import {
  getMainDefinition,
  resultKeyNameFromField,
} from "../utilities/index.js";
import type { DocumentNode, TypedDocumentNode } from "./index.js";
import { invariant } from "../utilities/globals/index.js";

type MatchesFragmentFn = (
  fragmentNode: InlineFragmentNode,
  typename: string
) => boolean;

export function maskQuery<TData = unknown>(
  data: TData,
  document: TypedDocumentNode<TData> | DocumentNode,
  matchesFragment: MatchesFragmentFn
): TData {
  const definition = getMainDefinition(document);
  const [masked, changed] = maskSelectionSet(
    data,
    definition.selectionSet,
    matchesFragment
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

  if (typeof fragmentName === "undefined") {
    invariant(
      fragments.length === 1,
      `Found %s fragments. \`fragmentName\` must be provided when there is more than 1 fragment.`,
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
    matchesFragment
  );

  return changed ? masked : data;
}

function maskSelectionSet(
  data: any,
  selectionSet: SelectionSetNode,
  matchesFragment: MatchesFragmentFn
): [data: any, changed: boolean] {
  if (Array.isArray(data)) {
    let changed = false;

    const masked = data.map((item) => {
      const [masked, itemChanged] = maskSelectionSet(
        item,
        selectionSet,
        matchesFragment
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
          const childSelectionSet = selection.selectionSet;

          memo[keyName] = data[keyName];

          if (childSelectionSet) {
            const [masked, childChanged] = maskSelectionSet(
              data[keyName],
              childSelectionSet,
              matchesFragment
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
            matchesFragment
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
          return [memo, true];
      }
    },
    [Object.create(null), false]
  );
}
