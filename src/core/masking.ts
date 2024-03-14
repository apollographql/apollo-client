import { Kind } from "graphql";
import type { SelectionSetNode } from "graphql";
import {
  getMainDefinition,
  resultKeyNameFromField,
} from "../utilities/index.js";
import type { DocumentNode, TypedDocumentNode } from "./index.js";

export function mask(
  data: any,
  document: TypedDocumentNode<any> | DocumentNode
) {
  const definition = getMainDefinition(document);
  const masked = maskSelection(data, definition.selectionSet);

  return { data: masked };
}

function maskSelection(data: any, selectionSet: SelectionSetNode): any {
  if (Array.isArray(data)) {
    return data.map((item) => maskSelection(item, selectionSet));
  }

  return selectionSet.selections.reduce(
    (masked, selection) => {
      switch (selection.kind) {
        case Kind.FIELD: {
          const keyName = resultKeyNameFromField(selection);
          const childSelectionSet = selection.selectionSet;

          masked[keyName] =
            childSelectionSet ?
              maskSelection({ ...data[keyName] }, childSelectionSet)
            : data[keyName];

          return masked;
        }
        case Kind.INLINE_FRAGMENT: {
          return { ...masked, ...maskSelection(data, selection.selectionSet) };
        }
        default:
          return masked;
      }
    },
    {} as typeof data
  );
}
