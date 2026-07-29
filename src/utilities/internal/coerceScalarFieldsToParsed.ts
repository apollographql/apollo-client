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

  function parseValue(
    fieldValue: unknown,
    typename: string | undefined,
    field: FieldNode
  ) {
    const scalar =
      typename && cache.getScalarForField(typename, field.name.value);

    return scalar ? scalar.coerceToParsed(fieldValue) : fieldValue;
  }

  function coerceArray(field: FieldNode, array: any[], typename: string) {
    const result: any[] = [];
    let changed = false;

    for (const item of array) {
      let coerced: unknown;

      if (Array.isArray(item)) {
        coerced = coerceArray(field, item, typename);
      } else if (field.selectionSet) {
        coerced = coerceSelectionSet(field.selectionSet, item);
      } else {
        coerced = parseValue(item, typename, field);
      }

      changed ||= coerced !== item;
      result.push(coerced);
    }

    return changed ? result : array;
  }

  function coerceSelectionSet(selectionSet: SelectionSetNode, data: any): any {
    if (data == null) return data;

    const result: Record<string, any> = {};
    let changed = false;

    if (Object.hasOwn(data, "__typename")) {
      result.__typename = data.__typename;
    }

    for (const selection of selectionSet.selections) {
      if (isField(selection)) {
        const resultName = resultKeyNameFromField(selection);
        const fieldValue = data[resultName];

        if (Array.isArray(fieldValue)) {
          const coerced = coerceArray(selection, fieldValue, data.__typename);

          changed ||= coerced !== fieldValue;
          result[resultName] = coerced;

          continue;
        } else if (selection.selectionSet) {
          const processed = coerceSelectionSet(
            selection.selectionSet,
            fieldValue
          );

          changed ||= processed !== fieldValue;
          result[resultName] = processed;

          continue;
        }

        const typename =
          Object.hasOwn(data, "__typename") ? data.__typename : undefined;

        const scalar =
          typename && cache.getScalarForField(typename, selection.name.value);
        const processed =
          scalar ? scalar.coerceToParsed(fieldValue) : fieldValue;

        changed ||= processed !== fieldValue;
        result[resultName] = processed;
      } else {
        const fragment = getFragmentFromSelection(selection, fragmentMap);

        const processed =
          fragment ? coerceSelectionSet(fragment.selectionSet, data) : data;
        changed ||= processed !== data;

        Object.assign(result, processed);
      }
    }

    return changed ? result : data;
  }

  return coerceSelectionSet(getMainDefinition(query).selectionSet, result);
}
