/// <reference path="../typings/browser/ambient/es6-promise/index.d.ts" />
/// <reference path="../typings/browser/ambient/graphql/index.d.ts" />
/// <reference path="../typings/browser/definitions/lodash/index.d.ts" />

import {
  isString,
  isNumber,
  isBoolean,
  isNull,
  isArray,
  isUndefined,
  assign,
} from 'lodash';

import {
  parseFragmentIfString,
  parseQueryIfString,
} from './parser';

import {
  cacheFieldNameFromField,
  resultFieldNameFromField,
} from './cacheUtils';

import {
  Document,
  OperationDefinition,
  SelectionSet,
  FragmentDefinition,
  Field,
} from 'graphql';

import {
  Store,
  StoreObject,
} from './store';

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
export function writeFragmentToStore({
  result,
  fragment,
  cache = {} as Store,
}: { result: Object, fragment: Document | string, cache?: Store }): Store {
  // Argument validation
  if (!fragment) {
    throw new Error('Must pass fragment.');
  }

  const parsedFragment: FragmentDefinition = parseFragmentIfString(fragment);
  const selectionSet: SelectionSet = parsedFragment.selectionSet;

  return writeSelectionSetToStore({
    result,
    selectionSet,
    cache,
  });
}

export function writeQueryToStore({
  result,
  query,
  cache = {} as Store,
}: { result: Object, query: Document | string, cache?: Store}): Store {
  const queryDefinition: OperationDefinition = parseQueryIfString(query);

  const resultWithDataId: Object = assign({
    __data_id: 'ROOT_QUERY',
  }, result);

  return writeSelectionSetToStore({
    result: resultWithDataId,
    selectionSet: queryDefinition.selectionSet,
    cache,
  });
}

function writeSelectionSetToStore({
  result,
  selectionSet,
  cache,
}: {
  result: any,
  selectionSet: SelectionSet,
  cache?: Store
}): Store {
  if (! isString(result.id) && ! isString(result.__data_id)) {
    throw new Error('Result passed to writeSelectionSetToStore must have a string ID');
  }

  const resultDataId: string = result['__data_id'] || result.id;

  const normalizedRootObj: StoreObject = {};

  selectionSet.selections.forEach((selection) => {
    const field = selection as Field;

    const cacheFieldName: string = cacheFieldNameFromField(field);
    const resultFieldName: string = resultFieldNameFromField(field);

    const value: any = result[resultFieldName];

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
      const thisIdList: Array<string> = [];

      value.forEach((item, index) => {
        const clonedItem: any = assign({}, item);

        if (! isString(item.id)) {
          clonedItem['__data_id'] = `${resultDataId}.${cacheFieldName}.${index}`;
        } else {
          clonedItem['__data_id'] = clonedItem.id;
        }

        thisIdList.push(clonedItem['__data_id']);

        writeSelectionSetToStore({
          result: clonedItem,
          cache,
          selectionSet: field.selectionSet,
        });
      });

      normalizedRootObj[cacheFieldName] = thisIdList;
      return;
    }

    // It's an object
    const clonedValue: any = assign({}, value);
    if (! isString(clonedValue.id)) {
      // Object doesn't have an ID, so store it with its field name and parent ID
      clonedValue['__data_id'] = `${resultDataId}.${cacheFieldName}`;
    } else {
      clonedValue['__data_id'] = clonedValue.id;
    }

    normalizedRootObj[cacheFieldName] = clonedValue['__data_id'];

    writeSelectionSetToStore({
      result: clonedValue,
      cache,
      selectionSet: field.selectionSet,
    });
  });

  cache[resultDataId] = normalizedRootObj; // eslint-disable-line no-param-reassign

  return cache;
}
