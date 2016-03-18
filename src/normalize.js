// fix this by using immutablejs later

import {
  isString,
  isNumber,
  isBoolean,
  isNull,
  isArray,
  isUndefined,
} from 'lodash';

import { parseFragmentIfString } from './parser';

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
  selectionSet,
  cache = {},
}) {
  // Argument validation
  if (!fragment && !selectionSet) {
    throw new Error('Must pass either fragment or selectionSet.');
  }

  let actualSelectionSet = selectionSet;
  if (fragment) {
    const parsedFragment = parseFragmentIfString(fragment);
    actualSelectionSet = parsedFragment.selectionSet;
  }

  if (! isString(result.id) && ! isString(result.__data_id)) {
    throw new Error('Result passed to normalizeResult must have a string ID');
  }
  // End argument validation

  const resultDataId = result['__data_id'] || result.id;

  const normalizedRootObj = {};

  actualSelectionSet.selections.forEach((selection) => {
    let cacheFieldName = selection.name.value;
    if (selection.arguments.length) {
      const argObj = {};
      selection.arguments.forEach((argument) => {
        argObj[argument.name.value] = argument.value.value;
      });
      const stringifiedArgs = JSON.stringify(argObj);
      cacheFieldName = `${cacheFieldName}(${stringifiedArgs})`;
    }

    const resultFieldName = selection.alias ?
      selection.alias.value :
      cacheFieldName;
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

        normalizeResult({
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

    normalizeResult({
      result: clonedValue,
      cache,
      selectionSet: selection.selectionSet,
    });
  });

  cache[resultDataId] = normalizedRootObj; // eslint-disable-line no-param-reassign

  return cache;
}
