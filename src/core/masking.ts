import { Kind } from "graphql";
import type { InlineFragmentNode, SelectionSetNode } from "graphql";
import {
  getMainDefinition,
  resultKeyNameFromField,
} from "../utilities/index.js";
import type { DocumentNode, TypedDocumentNode } from "./index.js";

type MatchesFragmentFn = (
  fragmentNode: InlineFragmentNode,
  typename: string
) => boolean;

export function mask(
  data: Record<string, unknown>,
  document: TypedDocumentNode<any> | DocumentNode,
  matchesFragment: MatchesFragmentFn
) {
  const definition = getMainDefinition(document);
  const [masked, changed] = maskSelectionSet(
    data,
    definition.selectionSet,
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
            const [masked, changed] = maskSelectionSet(
              data[keyName],
              childSelectionSet,
              matchesFragment
            );

            if (changed) {
              memo[keyName] = masked;
              return [memo, true];
            }
          }

          return [memo, changed];
        }
        case Kind.INLINE_FRAGMENT: {
          if (!matchesFragment(selection, data.__typename)) {
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
    [Object.create(Object.getPrototypeOf(data)), false]
  );
}
