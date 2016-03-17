import { parse } from 'graphql/language';

export function runFragment({ store, fragment, rootId }) {
  const parsedFragment = parse(fragment);

  if (parsedFragment.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }

  if (parsedFragment.definitions[0].kind !== 'FragmentDefinition') {
    throw new Error('Must be a fragment.');
  }

  const fragmentDef = parsedFragment.definitions[0];
  const rootObj = store[rootId];

  const result = {};
  fragmentDef.selectionSet.selections.forEach((selection) => {
    const key = selection.name.value;
    result[key] = rootObj[key];
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
