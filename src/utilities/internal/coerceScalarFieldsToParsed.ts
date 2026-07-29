import type { DocumentNode, SelectionSetNode } from "graphql";

import type { ApolloCache } from "@apollo/client/cache";

import { createFragmentMap } from "./createFragmentMap.js";
import { getFragmentDefinitions } from "./getFragmentDefinitions.js";
import { getFragmentFromSelection } from "./getFragmentFromSelection.js";
import { getMainDefinition } from "./getMainDefinition.js";
import { isField } from "./isField.js";
import { resultKeyNameFromField } from "./resultKeyNameFromField.js";
import type { FragmentMap } from "./types/FragmentMap.js";

export function coerceScalarFieldsToParsed(
  result: Record<string, any>,
  query: DocumentNode,
  cache: ApolloCache
): Record<string, any> {
  const coerce = (
    selectionSet: SelectionSetNode,
    data: any,
    fragmentMap: FragmentMap
  ): any => {
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
          const processed = fieldValue.map((item) => {
            const processedItem = coerce(selectionSet, item, fragmentMap);
            changed ||= item !== processedItem;

            return processedItem;
          });

          result[resultName] = processed;

          continue;
        } else if (selection.selectionSet) {
          const processed = coerce(
            selection.selectionSet,
            fieldValue,
            fragmentMap
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
          fragment ? coerce(fragment.selectionSet, data, fragmentMap) : data;
        changed ||= processed !== data;

        Object.assign(result, processed);
      }
    }

    return changed ? result : data;
  };

  return coerce(
    getMainDefinition(query).selectionSet,
    result,
    createFragmentMap(getFragmentDefinitions(query))
  );
}
