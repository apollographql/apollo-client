import { Kind } from "graphql";
import type { SelectionSetNode } from "graphql";
import {
  getMainDefinition,
  resultKeyNameFromField,
} from "../utilities/index.js";
import type { DocumentNode, TypedDocumentNode } from "./index.js";
import type { Policies } from "../cache/index.js";

export function mask(
  data: Record<string, unknown>,
  document: TypedDocumentNode<any> | DocumentNode,
  policies: Policies
) {
  const definition = getMainDefinition(document);
  const [masked, changed] = maskSelectionSet(
    data,
    definition.selectionSet,
    policies
  );

  return { data: changed ? masked : data };
}

function maskSelectionSet(
  data: any,
  selectionSet: SelectionSetNode,
  policies: Policies
): [data: any, changed: boolean] {
  if (Array.isArray(data)) {
    let changed = false;

    const masked = data.map((item) => {
      const [masked, itemChanged] = maskSelectionSet(
        item,
        selectionSet,
        policies
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
              policies
            );

            if (changed) {
              memo[keyName] = masked;
              return [memo, true];
            }
          }

          return [memo, changed];
        }
        case Kind.INLINE_FRAGMENT: {
          if (!policies.fragmentMatches(selection, data.__typename, data)) {
            return [memo, changed];
          }

          const [fragmentData, childChanged] = maskSelectionSet(
            data,
            selection.selectionSet,
            policies
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
