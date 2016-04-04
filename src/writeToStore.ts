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
  parseFragment,
  parseQuery,
} from './parser';

import {
  storeKeyNameFromField,
  resultKeyNameFromField,
} from './storeUtils';

import {
  OperationDefinition,
  SelectionSet,
  Selection,
  FragmentDefinition,
  Field,
  InlineFragment,
} from 'graphql';

import {
  NormalizedCache,
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
  store = {} as NormalizedCache,
  variables,
}: {
  result: Object,
  fragment: string,
  store?: NormalizedCache,
  variables?: Object,
}): NormalizedCache {
  // Argument validation
  if (!fragment) {
    throw new Error('Must pass fragment.');
  }

  const parsedFragment: FragmentDefinition = parseFragment(fragment);
  const selectionSet: SelectionSet = parsedFragment.selectionSet;

  return writeSelectionSetToStore({
    result,
    selectionSet,
    store,
    variables,
  });
}

export function writeQueryToStore({
  result,
  query,
  store = {} as NormalizedCache,
  variables,
}: {
  result: Object,
  query: string,
  store?: NormalizedCache,
  variables?: Object,
}): NormalizedCache {
  const queryDefinition: OperationDefinition = parseQuery(query);

  const resultWithDataId: Object = assign({
    __data_id: 'ROOT_QUERY',
  }, result);

  return writeSelectionSetToStore({
    result: resultWithDataId,
    selectionSet: queryDefinition.selectionSet,
    store,
    variables,
  });
}

export function writeSelectionSetToStore({
  result,
  selectionSet,
  store = {} as NormalizedCache,
  variables,
}: {
  result: any,
  selectionSet: SelectionSet,
  store?: NormalizedCache,
  variables: Object,
}): NormalizedCache {
  if (! isString(result.id) && ! isString(result.__data_id)) {
    throw new Error('Result passed to writeSelectionSetToStore must have a string ID');
  }

  const dataId: string = result['__data_id'] || result.id;

  selectionSet.selections.forEach((selection) => {
    if (isField(selection)) {
      const resultFieldKey: string = resultKeyNameFromField(selection);
      const value: any = result[resultFieldKey];

      if (isUndefined(value)) {
        throw new Error(`Can't find field ${resultFieldKey} on result object ${dataId}.`);
      }

      writeFieldToStore({
        dataId,
        value,
        variables,
        store,
        field: selection,
      });
    } else if (isInlineFragment(selection)) {
      // XXX what to do if this tries to write the same fields? Also, type conditions...
      writeSelectionSetToStore({
        result,
        selectionSet: selection.selectionSet,
        store,
        variables,
      });
    } else {
      throw new Error('Non-inline fragments not supported.');
    }
  });

  return store;
}

function writeFieldToStore({
  field,
  value,
  variables,
  store,
  dataId,
}: {
  field: Field,
  value: any,
  variables: {},
  store: NormalizedCache,
  dataId: string,
}) {
  let storeValue;

  const storeFieldName: string = storeKeyNameFromField(field, variables);

  // If it's a scalar, just store it in the store
  if (isString(value) || isNumber(value) || isBoolean(value) || isNull(value)) {
    storeValue = value;
  } else if (isArray(value)) {

    // GraphQL lists should be of the same type.
    // If it's an array of scalar values, don't normalize.
    if (isNull(field.selectionSet)) {
      storeValue = value;
    } else {

      const thisIdList: Array<string> = [];

      value.forEach((item, index) => {
        if (isNull(item)) {
          thisIdList.push(null);
        } else {
          const clonedItem: any = assign({}, item);

          if (! isString(clonedItem.id)) {
            clonedItem['__data_id'] = `${dataId}.${storeFieldName}.${index}`;
          } else {
            clonedItem['__data_id'] = clonedItem.id;
          }

          thisIdList.push(clonedItem['__data_id']);

          writeSelectionSetToStore({
            result: clonedItem,
            store,
            selectionSet: field.selectionSet,
            variables,
          });
        }
      });

      storeValue = thisIdList;

    }

  } else {
    // It's an object
    const clonedValue: any = assign({}, value);
    if (! isString(clonedValue.id)) {
      // Object doesn't have an ID, so store it with its field name and parent ID
      clonedValue['__data_id'] = `${dataId}.${storeFieldName}`;
    } else {
      clonedValue['__data_id'] = clonedValue.id;
    }

    writeSelectionSetToStore({
      result: clonedValue,
      store,
      selectionSet: field.selectionSet,
      variables,
    });

    storeValue = clonedValue['__data_id'];
  }

  const newStoreObj = assign({}, store[dataId], {
    [storeFieldName]: storeValue,
  }) as StoreObject;

  store[dataId] = newStoreObj;
}

function isField(selection: Selection): selection is Field {
  return selection.kind === 'Field';
}

function isInlineFragment(selection: Selection): selection is InlineFragment {
  return selection.kind === 'InlineFragment';
}
