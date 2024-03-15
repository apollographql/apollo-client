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
  let modified = false;

  if (Array.isArray(data)) {
    const array: any[] = [];

    data.forEach((value, index) => {
      const result = maskSelection(value, selectionSet);
      modified ||= result !== value;
      array[index] = result;
    });

    if (modified) {
      return array;
    }

    return data;
  }

  const obj = Object.create(Object.getPrototypeOf(data));
  selectionSet.selections.forEach((selection) => {
    switch (selection.kind) {
      case Kind.FIELD: {
        const keyName = resultKeyNameFromField(selection);
        const childSelectionSet = selection.selectionSet;

        const result =
          childSelectionSet ?
            maskSelection(data[keyName], childSelectionSet)
          : data[keyName];
        modified ||= result !== data[keyName];
        obj[keyName] = result;

        break;
      }
      case Kind.INLINE_FRAGMENT: {
        const result = maskSelection(data, selection.selectionSet);
        modified ||= result !== data;
        Object.assign(obj, result);

        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        // We are omitting the data in the fragment spread, so this acts as
        // modifying the original data object
        modified = true;
        break;
      }
    }
  });

  return modified ? obj : data;
}
