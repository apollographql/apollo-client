import { Kind } from "graphql";
import type { SelectionSetNode } from "graphql";
import {
  getMainDefinition,
  resultKeyNameFromField,
} from "../utilities/index.js";
import type { DocumentNode, TypedDocumentNode } from "./index.js";
import type { Policies } from "../cache/index.js";
import equal from "@wry/equality";

export function mask(
  data: Record<string, unknown>,
  document: TypedDocumentNode<any> | DocumentNode,
  policies: Policies
) {
  const definition = getMainDefinition(document);
  const masked = maskSelectionSet(data, definition.selectionSet, policies);

  return equal(data, masked) ? { data } : { data: masked };
}

function maskSelectionSet(
  data: any,
  selectionSet: SelectionSetNode,
  policies: Policies
): any {
  if (Array.isArray(data)) {
    return data.map((item) => {
      const masked = maskSelectionSet(item, selectionSet, policies);

      return equal(item, masked) ? item : masked;
    });
  }

  return selectionSet.selections.reduce(
    (memo, selection) => {
      switch (selection.kind) {
        case Kind.FIELD: {
          const keyName = resultKeyNameFromField(selection);
          const childSelectionSet = selection.selectionSet;

          memo[keyName] = data[keyName];

          if (childSelectionSet) {
            const masked = maskSelectionSet(
              data[keyName],
              childSelectionSet,
              policies
            );

            if (!equal(memo[keyName], masked)) {
              memo[keyName] = masked;
            }
          }

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
