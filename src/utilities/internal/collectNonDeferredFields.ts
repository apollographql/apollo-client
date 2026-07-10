import type { SelectionSetNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { getFragmentFromSelection } from "./getFragmentFromSelection.js";
import { isDeferredFragment } from "./isDeferredFragment.js";
import { isField } from "./isField.js";
import { isTypenameField } from "./isTypenameField.js";
import { resultKeyNameFromField } from "./resultKeyNameFromField.js";
import type { FragmentMap } from "./types/FragmentMap.js";

export type FieldMap = Map<string, FieldMap | true>;

/**
 * Returns a map of non-deferred fields for the current selection set. Useful
 * to detect non-deferred, overlapping fields from a defer boundary
 *
 * @internal
 */
export function collectNonDeferredFields(
  selectionSet: SelectionSetNode,
  fragmentMap: FragmentMap,
  variables: OperationVariables,
  visitedFragments = new Map<string, FieldMap>()
): FieldMap {
  const collectedFieldsMap: FieldMap = new Map();

  for (const selection of selectionSet.selections) {
    if (isField(selection)) {
      if (isTypenameField(selection)) continue;

      const name = resultKeyNameFromField(selection);

      if (selection.selectionSet) {
        const fieldsForSelection = collectNonDeferredFields(
          selection.selectionSet,
          fragmentMap,
          visitedFragments
        );

        if (collectedFieldsMap.has(name)) {
          mergeFieldMaps(
            // We can reasonably assume the value is a nested map instead of
            // `true` without checking its type, otherwise we'd have a broken
            // query which would have errored on the server
            collectedFieldsMap.get(name)! as FieldMap,
            fieldsForSelection
          );
        } else {
          collectedFieldsMap.set(name, fieldsForSelection);
        }
      } else {
        collectedFieldsMap.set(name, true);
      }
    } else if (!isDeferredFragment(selection, variables)) {
      const fragment = getFragmentFromSelection(selection, fragmentMap);
      if (!fragment) continue;

      let fragmentCollectedFieldsMap: FieldMap;

      if (fragment.kind === Kind.FRAGMENT_DEFINITION) {
        fragmentCollectedFieldsMap =
          visitedFragments.get(fragment.name.value) ||
          collectNonDeferredFields(
            fragment.selectionSet,
            fragmentMap,
            visitedFragments
          );
      } else {
        fragmentCollectedFieldsMap = collectNonDeferredFields(
          fragment.selectionSet,
          fragmentMap,
          visitedFragments
        );
      }

      mergeFieldMaps(collectedFieldsMap, fragmentCollectedFieldsMap);
    }
  }

  return collectedFieldsMap;
}

function mergeFieldMaps(target: FieldMap, source: FieldMap) {
  for (const key of source.keys()) {
    if (target.has(key)) {
      const targetValue = target.get(key)!;
      const sourceValue = source.get(key)!;

      if (targetValue === true || sourceValue === true) continue;

      target.set(key, mergeFieldMaps(targetValue, sourceValue));
    } else {
      target.set(key, source.get(key)!);
    }
  }

  return target;
}
