import type { DocumentNode, FieldNode, SelectionSetNode } from "graphql";

import type { ApolloCache, ScalarType } from "@apollo/client/cache";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

import { createFragmentMap } from "./createFragmentMap.js";
import { getFragmentDefinitions } from "./getFragmentDefinitions.js";
import { getFragmentFromSelection } from "./getFragmentFromSelection.js";
import { getMainDefinition } from "./getMainDefinition.js";
import { getOperationDefinition } from "./getOperationDefinition.js";
import { isField } from "./isField.js";
import { matchScalarList } from "./matchScalarList.js";
import { resultKeyNameFromField } from "./resultKeyNameFromField.js";
import { unwrapScalarType } from "./unwrapScalarType.js";

/** @internal */
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

  function coerceFieldArray(
    field: FieldNode,
    fieldValue: unknown[],
    typename: string | undefined,
    scalarType: ScalarType | undefined
  ) {
    let changed = false;

    const items = fieldValue.map((item) => {
      const coerced = coerceField(field, item, typename, scalarType);

      changed ||= coerced !== item;
      return coerced;
    });

    return changed ? items : fieldValue;
  }

  function coerceField(
    field: FieldNode,
    fieldValue: unknown,
    typename: string | undefined,
    scalarType: ScalarType | undefined
  ): unknown {
    if (Array.isArray(fieldValue) && !scalarType) {
      return coerceFieldArray(field, fieldValue, typename, scalarType);
    }

    if (field.selectionSet) {
      return coerceSelectionSet(field.selectionSet, fieldValue);
    }

    if (fieldValue === null || !typename) return fieldValue;

    if (scalarType) {
      const match = matchScalarList(scalarType);

      if (match) {
        if (Array.isArray(fieldValue)) {
          return coerceFieldArray(field, fieldValue, typename, match[1]);
        } else {
          if (__DEV__) {
            invariant.warn(
              "The custom scalar configuration for '%s' uses list type '%s', but the value is not an array. The value was coerced as '%s' anyway.",
              `${typename}.${field.name.value}`,
              scalarType,
              unwrapScalarType(scalarType)
            );
          }
        }
      }

      const scalar = cache.getScalar(unwrapScalarType(scalarType));

      if (scalar) {
        return scalar.coerceToParsed(fieldValue);
      }
    }

    return fieldValue;
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

    const workSet = new Set(selectionSet.selections);
    workSet.forEach((selection) => {
      if (isField(selection)) {
        const resultName = resultKeyNameFromField(selection);
        if (!Object.hasOwn(data, resultName)) return;

        const fieldValue = data[resultName];
        const coerced = coerceField(
          selection,
          fieldValue,
          typename,
          typename ?
            cache.getScalarTypeForField(typename, selection.name.value)
          : undefined
        );

        changed ||= coerced !== fieldValue;
        result[resultName] = coerced;
      } else {
        const fragment = getFragmentFromSelection(selection, fragmentMap);

        if (fragment && typename && cache.fragmentMatches(fragment, typename)) {
          fragment.selectionSet.selections.forEach((s) => workSet.add(s));
        }
      }
    });

    return changed ? result : data;
  }

  return coerceSelectionSet(
    getMainDefinition(query).selectionSet,
    result,
    cache.getRootTypename(operationType)
  );
}
