import type { DocumentNode, FieldNode, SelectionSetNode } from "graphql";

import type { ApolloCache } from "@apollo/client/cache";
import { invariant } from "@apollo/client/utilities/invariant";

import { createFragmentMap } from "./createFragmentMap.js";
import { getFragmentDefinitions } from "./getFragmentDefinitions.js";
import { getFragmentFromSelection } from "./getFragmentFromSelection.js";
import { getMainDefinition } from "./getMainDefinition.js";
import { getOperationDefinition } from "./getOperationDefinition.js";
import { isField } from "./isField.js";
import { resultKeyNameFromField } from "./resultKeyNameFromField.js";

export function coerceScalarFieldsToParsed(
  result: Record<string, any>,
  query: DocumentNode,
  cache: ApolloCache
): Record<string, any> {
  const operationType = getOperationDefinition(query)?.operation;
  const fragmentMap = createFragmentMap(getFragmentDefinitions(query));

  invariant(
    operationType,
    "Document node must be a query, mutation, or subscription"
  );

  function coerceField(
    field: FieldNode,
    fieldValue: unknown,
    typename: string | undefined
  ): unknown {
    let changed = false;

    if (Array.isArray(fieldValue)) {
      const items = fieldValue.map((item) => {
        const coerced = coerceField(field, item, typename);

        changed ||= coerced !== item;
        return coerced;
      });

      return changed ? items : fieldValue;
    }

    if (field.selectionSet) {
      return coerceSelectionSet(field.selectionSet, fieldValue);
    }

    if (fieldValue === null || !typename) return fieldValue;

    const scalar = cache.getScalarForField(typename, field.name.value);
    return scalar ? scalar.coerceToParsed(fieldValue) : fieldValue;
  }

  function coerceSelectionSet(
    selectionSet: SelectionSetNode,
    data: any,
    typename?: string
  ): any {
    if (data === null || typeof data !== "object") return data;

    const result: Record<string, any> = { ...data };
    let changed = false;

    if (Object.hasOwn(data, "__typename")) {
      typename = data.__typename;
    }

    function visit(selectionSet: SelectionSetNode) {
      for (const selection of selectionSet.selections) {
        if (isField(selection)) {
          const resultName = resultKeyNameFromField(selection);

          if (!Object.hasOwn(data, resultName)) continue;

          const fieldValue = data[resultName];
          const coerced = coerceField(selection, fieldValue, typename);

          changed ||= coerced !== fieldValue;
          result[resultName] = coerced;
        } else {
          const fragment = getFragmentFromSelection(selection, fragmentMap);

          if (fragment) {
            visit(fragment.selectionSet);
          }
        }
      }
    }

    visit(selectionSet);

    return changed ? result : data;
  }

  return coerceSelectionSet(
    getMainDefinition(query).selectionSet,
    result,
    cache.getRootTypename(operationType)
  );
}
