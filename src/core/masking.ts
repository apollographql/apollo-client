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

export function mask(
  data: Record<string, unknown>,
  document: TypedDocumentNode<any> | DocumentNode
) {
  const definition = getMainDefinition(document);
  const masked = maskSelectionSet(data, definition.selectionSet);

  return { data: masked };
}

function maskSelectionSet(data: any, selectionSet: SelectionSetNode): any {
  if (Array.isArray(data)) {
    return data.map((item) => {
      return maskSelectionSet(item, selectionSet);
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
              maskSelectionSet(data[keyName], childSelectionSet)
            : data[keyName];

          return memo;
        }
        case Kind.INLINE_FRAGMENT: {
          if (!matchesTypeCondition(data, selection)) {
            return memo;
          }

          return { ...memo, ...maskSelectionSet(data, selection.selectionSet) };
        }
        default:
          return memo;
      }
    },
    Object.create(Object.getPrototypeOf(data))
  );
}

function matchesTypeCondition(
  data: Record<string, unknown>,
  fragment: InlineFragmentNode | FragmentDefinitionNode
) {
  if (!fragment.typeCondition) {
    return true;
  }

  return (
    "__typename" in data &&
    data.__typename === fragment.typeCondition.name.value
  );
}
