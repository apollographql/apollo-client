import type { DocumentNode, FieldNode, SelectionSetNode } from "graphql";

import type { ApolloCache } from "@apollo/client/cache";

import { createFragmentMap } from "./createFragmentMap.js";
import { getFragmentDefinitions } from "./getFragmentDefinitions.js";
import { getFragmentFromSelection } from "./getFragmentFromSelection.js";
import { getMainDefinition } from "./getMainDefinition.js";
import { isField } from "./isField.js";
import { resultKeyNameFromField } from "./resultKeyNameFromField.js";

export function coerceScalarFieldsToParsed(
  result: Record<string, any>,
  query: DocumentNode,
  cache: ApolloCache
): Record<string, any> {
  const fragmentMap = createFragmentMap(getFragmentDefinitions(query));

  function coerce(
    fieldValue: unknown,
    typename: string | undefined,
    field: FieldNode
  ) {
    if (fieldValue === null) return null;

    const scalar =
      typename && cache.getScalarForField(typename, field.name.value);

    return scalar ? scalar.coerceToParsed(fieldValue) : fieldValue;
  }

  function coerceArray(
    field: FieldNode,
    array: any[],
    typename: string | undefined
  ) {
    const result: any[] = [];
    let changed = false;

    for (const item of array) {
      let coerced: unknown;

      if (Array.isArray(item)) {
        coerced = coerceArray(field, item, typename);
      } else if (field.selectionSet) {
        coerced = coerceSelectionSet(field.selectionSet, item);
      } else {
        coerced = coerce(item, typename, field);
      }

      changed ||= coerced !== item;
      result.push(coerced);
    }

    return changed ? result : array;
  }

  function coerceSelectionSet(selectionSet: SelectionSetNode, data: any): any {
    if (data === null) return null;

    const result: Record<string, any> = {};
    let changed = false;
    let typename: string | undefined;

    if (Object.hasOwn(data, "__typename")) {
      typename = result.__typename = data.__typename;
    }

    for (const selection of selectionSet.selections) {
      if (isField(selection)) {
        const resultName = resultKeyNameFromField(selection);
        const fieldValue = data[resultName];

        let coerced: unknown;
        if (Array.isArray(fieldValue)) {
          coerced = coerceArray(selection, fieldValue, typename);
        } else if (selection.selectionSet) {
          coerced = coerceSelectionSet(selection.selectionSet, fieldValue);
        } else {
          coerced = coerce(fieldValue, typename, selection);
        }

        changed ||= coerced !== fieldValue;
        result[resultName] = coerced;
      } else {
        const fragment = getFragmentFromSelection(selection, fragmentMap);
        let coerced = data;

        if (fragment && typename && cache.fragmentMatches(fragment, typename)) {
          coerced = coerceSelectionSet(fragment.selectionSet, data);
          Object.assign(result, coerced);
        }

        changed ||= coerced !== data;
      }
    }

    return changed ? result : data;
  }

  return coerceSelectionSet(getMainDefinition(query).selectionSet, result);
}
