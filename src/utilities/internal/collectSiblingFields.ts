import type { SelectionSetNode } from "graphql";
import type { SelectionNode } from "graphql";
import { Kind } from "graphql";

import { DeepMerger } from "./DeepMerger.js";
import { getFragmentFromSelection } from "./getFragmentFromSelection.js";
import { isField } from "./isField.js";
import { isTypenameField } from "./isTypenameField.js";
import { resultKeyNameFromField } from "./resultKeyNameFromField.js";
import type { FragmentMap } from "./types/FragmentMap.js";

export type FieldMap = {
  [fieldName: string]: FieldMap | true;
};

interface CollectionContext {
  fragmentMap: FragmentMap;
  exclude: SelectionNode;
}

/**
 * Returns a map of sibling fields for a selection set. Useful to detect
 * overlapping fields.
 *
 * @internal
 */
export function collectSiblingFields(
  selectionSet: SelectionSetNode,
  context: CollectionContext,
  visitedFragments = new Map<string, FieldMap>()
): FieldMap {
  let collectedFieldsMap: FieldMap = {};
  const { fragmentMap } = context;

  for (const selection of selectionSet.selections) {
    if (context.exclude === selection) continue;

    if (isField(selection)) {
      if (isTypenameField(selection)) continue;

      const name = resultKeyNameFromField(selection);

      if (selection.selectionSet) {
        const fieldsForSelection = collectSiblingFields(
          selection.selectionSet,
          context,
          visitedFragments
        );

        if (Object.hasOwn(collectedFieldsMap, name)) {
          collectedFieldsMap[name] = mergeFieldMaps(
            // We can reasonably assume the value is a nested map instead of
            // `true` without checking its type, otherwise we'd have a broken
            // query which would have errored on the server
            collectedFieldsMap[name]! as FieldMap,
            fieldsForSelection
          );
        } else {
          collectedFieldsMap[name] = fieldsForSelection;
        }
      } else {
        collectedFieldsMap[name] = true;
      }
    } else {
      const fragment = getFragmentFromSelection(selection, fragmentMap);
      if (!fragment) continue;

      let fragmentCollectedFieldsMap: FieldMap;

      if (fragment.kind === Kind.FRAGMENT_DEFINITION) {
        fragmentCollectedFieldsMap =
          visitedFragments.get(fragment.name.value) ||
          collectSiblingFields(
            fragment.selectionSet,
            context,
            visitedFragments
          );

        visitedFragments.set(fragment.name.value, fragmentCollectedFieldsMap);
      } else {
        fragmentCollectedFieldsMap = collectSiblingFields(
          fragment.selectionSet,
          context,
          visitedFragments
        );
      }

      collectedFieldsMap = mergeFieldMaps(
        collectedFieldsMap,
        fragmentCollectedFieldsMap
      );
    }
  }

  return collectedFieldsMap;
}

function mergeFieldMaps(target: FieldMap, source: FieldMap) {
  return new DeepMerger().merge(target, source);
}
