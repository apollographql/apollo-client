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
  const masked = maskSelectionSet(data, definition.selectionSet, policies);

  return { data: masked };
}

function maskSelectionSet(
  data: any,
  selectionSet: SelectionSetNode,
  policies: Policies
): any {
  if (Array.isArray(data)) {
    return data.map((item) => {
      return maskSelectionSet(item, selectionSet, policies);
    });
  }

  return selectionSet.selections.reduce(
    (memo, selection) => {
      switch (selection.kind) {
        case Kind.FIELD: {
          const keyName = resultKeyNameFromField(selection);
          const childSelectionSet = selection.selectionSet;

          memo[keyName] =
            childSelectionSet ?
              maskSelectionSet(data[keyName], childSelectionSet, policies)
            : data[keyName];

          return memo;
        }
        case Kind.INLINE_FRAGMENT: {
          if (!policies.fragmentMatches(selection, data.__typename, data)) {
            return memo;
          }

          return {
            ...memo,
            ...maskSelectionSet(data, selection.selectionSet, policies),
          };
        }
        default:
          return memo;
      }
    },
    Object.create(Object.getPrototypeOf(data))
  );
}
