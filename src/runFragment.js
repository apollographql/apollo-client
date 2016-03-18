import { isArray, has } from 'lodash';
import { parseFragmentIfString, parseIfString } from './parser';

export function runQuery({ store, query }) {
  const queryDef = parseIfString(query);
  console.log(queryDef);
}

export function runFragment({ store, fragment, rootId }) {
  const fragmentDef = parseFragmentIfString(fragment);

  return runSelectionSet({ store, rootId, selectionSet: fragmentDef.selectionSet });
}

function runSelectionSet({ store, rootId, selectionSet }) {
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
          selectionSet: selection.selectionSet,
        });
      });
      return;
    }

    // This is a nested query
    result[key] = runSelectionSet({
      store,
      rootId: rootObj[key],
      selectionSet: selection.selectionSet,
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

function printAST(fragAst) { // eslint-disable-line no-unused-vars
  console.log(JSON.stringify(stripLoc(fragAst), null, 2)); // eslint-disable-line no-console
}
