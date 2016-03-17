import { parse } from 'graphql/language';
import { isArray, has } from 'lodash';

export function runFragment({ store, fragment, rootId }) {
  const parsedFragment = parse(fragment);

  if (parsedFragment.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }

  if (parsedFragment.definitions[0].kind !== 'FragmentDefinition') {
    throw new Error('Must be a fragment.');
  }

  const fragmentDef = parsedFragment.definitions[0];

  return runSelectionSet({ store, rootId, selectionSet: fragmentDef.selectionSet })
}

function runSelectionSet({ store, rootId, selectionSet}) {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
  }

  const result = {};
  const rootObj = store[rootId];

  selectionSet.selections.forEach((selection) => {
    const key = selection.name.value;

    if (! has(rootObj, key)) {
      throw new Error(`Can't find field ${key} on object ${rootObj}.`);
    }

    if (! selection.selectionSet) {
      result[key] = rootObj[key];
      return;
    }

    if (isArray(rootObj[key])) {
      result[key] = rootObj[key].map((id) => {
        return runSelectionSet({
          store,
          rootId: id,
          selectionSet: selection.selectionSet
        })
      });
      return;
    }

    // This is a nested query
    result[key] = runSelectionSet({
      store,
      rootId: rootObj[key],
      selectionSet: selection.selectionSet
    });
  });

  return result;
}

function stripLoc(obj) {
  // For development only!
  const _ = require('lodash');
  if (! _.isObject(obj)) {
    return obj;
  }

  const omitted = _.omit(obj, ['loc']);

  return _.mapValues(omitted, (value) => {
    return stripLoc(value);
  });
}

function printAST(fragAst) {
  console.log(JSON.stringify(stripLoc(fragAst), null, 2));
}
