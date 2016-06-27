import {
  FragmentMap,
} from '../queries/getFromAST';

import {
  SelectionSet,
  Field,
} from 'graphql';

import {
  isField,
  isInlineFragment,
} from './storeUtils';

import cloneDeep = require('lodash.clonedeep');
import isNumber = require('lodash.isnumber');

export function scopeSelectionSetToResultPath({
  selectionSet,
  fragmentMap,
  path,
}: {
  selectionSet: SelectionSet,
  fragmentMap?: FragmentMap,
  // Path segment is string for objects, number for arrays
  path: (string | number)[],
}): SelectionSet {
  let currSelSet = selectionSet;

  path
    // Arrays are not represented in GraphQL AST
    .filter((pathSegment) => !isNumber(pathSegment))
    .forEach((pathSegment) => {
      currSelSet = followOnePathSegment(currSelSet, pathSegment as string);
    });

  return currSelSet;
}

function followOnePathSegment(currSelSet: SelectionSet, pathSegment: string): SelectionSet {
  const matchingFields: Field[] = getMatchingFields(currSelSet, pathSegment);

  if (matchingFields.length < 1) {
    throw new Error(`No matching field found in query for path segment: ${pathSegment}`);
  }

  if (matchingFields.length > 1) {
    throw new Error(`Multiple fields found in query for path segment: ${pathSegment}. \
      Please file an issue on Apollo Client if you run into this situation.`);
  }

  return matchingFields[0].selectionSet;
}

function getMatchingFields(currSelSet: SelectionSet, pathSegment: string): Field[] {
  const matching = [];

  currSelSet.selections.forEach((selection) => {
    if (isField(selection)) {
     if (selection.name.value === pathSegment) {
       matching.push(selection);
     }
    }
  });

  return matching;
}
