import {
  FragmentMap,
} from '../queries/getFromAST';

import {
  SelectionSetNode,
  FieldNode,
} from 'graphql';

import {
  isField,
  isInlineFragment,
  resultKeyNameFromField,
} from './storeUtils';

// The type of a path
export type StorePath = (string|number)[];

// This function takes a json blob and a path array, and returns the object at that path in the JSON
// blob.
export function scopeJSONToResultPath({
  json,
  path,
}: {
  json: any,
  path: StorePath,
}) {
  let current = json;
  path.forEach((pathSegment) => {
    current = current[pathSegment];
  });
  return current;
}

// Using the same path format as scopeJSONToResultPath, this applies the same operation to a GraphQL
// query. You get the selection set of the query at the path specified. It also reaches into
// fragments.
export function scopeSelectionSetToResultPath({
  selectionSet,
  fragmentMap,
  path,
}: {
  selectionSet: SelectionSetNode,
  fragmentMap?: FragmentMap,
  // Path segment is string for objects, number for arrays
  path: StorePath,
}): SelectionSetNode {
  let currSelSet = selectionSet;

  path
    // Arrays are not represented in GraphQL AST
    .filter((pathSegment) => typeof pathSegment !== 'number')
    .forEach((pathSegment) => {
      currSelSet = followOnePathSegment(currSelSet, pathSegment as string, fragmentMap);
    });

  return currSelSet;
}

// Helper function for scopeSelectionSetToResultPath
function followOnePathSegment(
  currSelSet: SelectionSetNode,
  pathSegment: string,
  fragmentMap: FragmentMap,
): SelectionSetNode {
  const matchingFields: FieldNode[] = getMatchingFields(currSelSet, pathSegment, fragmentMap);

  if (matchingFields.length < 1) {
    throw new Error(`No matching field found in query for path segment: ${pathSegment}`);
  }

  if (matchingFields.length > 1) {
    throw new Error(`Multiple fields found in query for path segment "${pathSegment}". \
Please file an issue on Apollo Client if you run into this situation.`);
  }

  return matchingFields[0].selectionSet;
}

// Helper function for followOnePathSegment
function getMatchingFields(
  currSelSet: SelectionSetNode,
  pathSegment: string,
  fragmentMap: FragmentMap,
): FieldNode[] {
  let matching: any[] = [];

  currSelSet.selections.forEach((selection) => {
    if (isField(selection)) {
      if (resultKeyNameFromField(selection) === pathSegment) {
        matching.push(selection);
      }
    } else if (isInlineFragment(selection)) {
      matching = matching.concat(
        getMatchingFields(selection.selectionSet, pathSegment, fragmentMap));
    } else { // is named fragment
      const fragment = fragmentMap[selection.name.value];
      matching = matching.concat(
        getMatchingFields(fragment.selectionSet, pathSegment, fragmentMap));
    }
  });

  return matching;
}
