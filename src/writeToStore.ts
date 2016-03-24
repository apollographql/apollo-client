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
  storeKeyNameFromField,
  resultKeyNameFromField,
} from './storeUtils';

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
 * Convert a nested GraphQL result into a normalized store, where each object from the schema
 * appears exactly once.
 * @param  {Object} result Arbitrary nested JSON, returned from the GraphQL server
 * @param  {String} [fragment] The GraphQL fragment used to fetch the data in result
 * @param  {SelectionSet} [selectionSet] The parsed selection set for the subtree of the query this
 *                                       result represents
 * @param  {Object} [store] The store to merge into
 * @return {Object} The resulting store
 */
export function writeFragmentToStore({
  result,
  fragment,
  store = {} as Store,
}: { result: Object, fragment: Document | string, store?: Store }): Store {
  // Argument validation
  if (!fragment) {
    throw new Error('Must pass fragment.');
  }

  const parsedFragment: FragmentDefinition = parseFragmentIfString(fragment);
  const selectionSet: SelectionSet = parsedFragment.selectionSet;

  return writeSelectionSetToStore({
    result,
    selectionSet,
    store,
  });
}

export function writeQueryToStore({
  result,
  query,
  store = {} as Store,
}: { result: Object, query: Document | string, store?: Store}): Store {
  const queryDefinition: OperationDefinition = parseQueryIfString(query);

  const resultWithDataId: Object = assign({
    __data_id: 'ROOT_QUERY',
  }, result);

  return writeSelectionSetToStore({
    result: resultWithDataId,
    selectionSet: queryDefinition.selectionSet,
    store,
  });
}

export function writeSelectionSetToStore({
  result,
  selectionSet,
  store = {} as Store,
}: {
  result: any,
  selectionSet: SelectionSet,
  store?: Store
}): Store {
  if (! isString(result.id) && ! isString(result.__data_id)) {
    throw new Error('Result passed to writeSelectionSetToStore must have a string ID');
  }

  const resultDataId: string = result['__data_id'] || result.id;

  const normalizedRootObj: StoreObject = {};

  selectionSet.selections.forEach((selection) => {
    const field = selection as Field;

    const storeFieldName: string = storeKeyNameFromField(field);
    const resultFieldKey: string = resultKeyNameFromField(field);

    const value: any = result[resultFieldKey];

    if (isUndefined(value)) {
      throw new Error(`Can't find field ${resultFieldKey} on result object ${resultDataId}.`);
    }

    // If it's a scalar, just store it in the store
    if (isString(value) || isNumber(value) || isBoolean(value) || isNull(value)) {
      normalizedRootObj[storeFieldName] = value;
      return;
    }

    // If it's an array
    if (isArray(value)) {
      const thisIdList: Array<string> = [];

      value.forEach((item, index) => {
        const clonedItem: any = assign({}, item);

        if (! isString(item.id)) {
          clonedItem['__data_id'] = `${resultDataId}.${storeFieldName}.${index}`;
        } else {
          clonedItem['__data_id'] = clonedItem.id;
        }

        thisIdList.push(clonedItem['__data_id']);

        writeSelectionSetToStore({
          result: clonedItem,
          store,
          selectionSet: field.selectionSet,
        });
      });

      normalizedRootObj[storeFieldName] = thisIdList;
      return;
    }

    // It's an object
    const clonedValue: any = assign({}, value);
    if (! isString(clonedValue.id)) {
      // Object doesn't have an ID, so store it with its field name and parent ID
      clonedValue['__data_id'] = `${resultDataId}.${storeFieldName}`;
    } else {
      clonedValue['__data_id'] = clonedValue.id;
    }

    normalizedRootObj[storeFieldName] = clonedValue['__data_id'];

    writeSelectionSetToStore({
      result: clonedValue,
      store,
      selectionSet: field.selectionSet,
    });
  });

  let newStoreObj = normalizedRootObj;
  if (store[resultDataId]) {
    // This object already exists in the store - extend it rather than overwriting the fields
    newStoreObj = assign({}, store[resultDataId], normalizedRootObj);
  }

  // Weird that we are overwriting. ImmutableJS could come in handy here
  store[resultDataId] = newStoreObj; // eslint-disable-line no-param-reassign

  return store;
}
