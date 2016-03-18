// fix this by using immutablejs later

import {
  isString,
  isNumber,
  isBoolean,
  isNull,
  isArray,
  isUndefined,
} from 'lodash';

import {
  parseFragmentIfString,
  parseQueryIfString,
} from './parser';

import {
  cacheFieldNameFromSelection,
  resultFieldNameFromSelection,
} from './cacheUtils';

// import {
//   printAST,
// } from './debug';

/**
 * Convert a nested GraphQL result into a normalized cache, where each object from the schema
 * appears exactly once.
 * @param  {Object} result Arbitrary nested JSON, returned from the GraphQL server
 * @param  {String} [fragment] The GraphQL fragment used to fetch the data in result
 * @param  {SelectionSet} [selectionSet] The parsed selection set for the subtree of the query this
 *                                       result represents
 * @param  {Object} [cache] The cache to merge into
 * @return {Object} The resulting cache
 */
export function normalizeResult({
  result,
  fragment,
  cache = {},
}) {
  // Argument validation
  if (!fragment) {
    throw new Error('Must pass fragment.');
  }

  const parsedFragment = parseFragmentIfString(fragment);
  const selectionSet = parsedFragment.selectionSet;

  return writeSelectionSetResult({
    result,
    selectionSet,
    cache,
  });
}

export function writeQueryResult({
  result,
  query,
  cache = {},
}) {
  const queryDefinition = parseQueryIfString(query);

  const resultWithDataId = {
    __data_id: 'ROOT_QUERY',
    ...result,
  };

  return writeSelectionSetResult({
    result: resultWithDataId,
    selectionSet: queryDefinition.selectionSet,
    cache,
  });
}

function writeSelectionSetResult({
  result,
  selectionSet,
  cache,
}) {
  if (! isString(result.id) && ! isString(result.__data_id)) {
    throw new Error('Result passed to writeSelectionSetResult must have a string ID');
  }

  const resultDataId = result['__data_id'] || result.id;

  const normalizedRootObj = {};

  selectionSet.selections.forEach((selection) => {
    const cacheFieldName = cacheFieldNameFromSelection(selection);
    const resultFieldName = resultFieldNameFromSelection(selection);

    const value = result[resultFieldName];

    if (isUndefined(value)) {
      throw new Error(`Can't find field ${resultFieldName} on result object ${resultDataId}.`);
    }

    // If it's a scalar, just store it in the cache
    if (isString(value) || isNumber(value) || isBoolean(value) || isNull(value)) {
      normalizedRootObj[cacheFieldName] = value;
      return;
    }

    // If it's an array
    if (isArray(value)) {
      const thisIdList = [];

      value.forEach((item, index) => {
        const clonedItem = { ...item };

        if (! isString(item.id)) {
          clonedItem['__data_id'] = `${resultDataId}.${cacheFieldName}.${index}`;
        } else {
          clonedItem['__data_id'] = clonedItem.id;
        }

        thisIdList.push(clonedItem['__data_id']);

        writeSelectionSetResult({
          result: clonedItem,
          cache,
          selectionSet: selection.selectionSet,
        });
      });

      normalizedRootObj[cacheFieldName] = thisIdList;
      return;
    }

    // It's an object
    const clonedValue = { ...value };
    if (! isString(clonedValue.id)) {
      // Object doesn't have an ID, so store it with its field name and parent ID
      clonedValue['__data_id'] = `${resultDataId}.${cacheFieldName}`;
    } else {
      clonedValue['__data_id'] = clonedValue.id;
    }

    normalizedRootObj[cacheFieldName] = clonedValue['__data_id'];

    writeSelectionSetResult({
      result: clonedValue,
      cache,
      selectionSet: selection.selectionSet,
    });
  });

  cache[resultDataId] = normalizedRootObj; // eslint-disable-line no-param-reassign

  return cache;
}
