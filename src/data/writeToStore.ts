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
} from '../parser';

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

  if (!result['id']) {
    throw new Error('Result must have id when writing fragment to store.');
  }

  return writeSelectionSetToStore({
    dataId: result['id'],
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

  return writeSelectionSetToStore({
    dataId: 'ROOT_QUERY',
    result,
    selectionSet: queryDefinition.selectionSet,
    store,
    variables,
  });
}

export function writeSelectionSetToStore({
  result,
  dataId,
  selectionSet,
  store = {} as NormalizedCache,
  variables,
}: {
  dataId: string,
  result: any,
  selectionSet: SelectionSet,
  store?: NormalizedCache,
  variables: Object,
}): NormalizedCache {
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
        dataId,
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
          const itemDataId = isString(item.id) ?
            item.id :
            `${dataId}.${storeFieldName}.${index}`;

          thisIdList.push(itemDataId);

          writeSelectionSetToStore({
            dataId: itemDataId,
            result: item,
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
    const valueDataId = isString(value.id) ?
      value.id :
      `${dataId}.${storeFieldName}`;

    writeSelectionSetToStore({
      dataId: valueDataId,
      result: value,
      store,
      selectionSet: field.selectionSet,
      variables,
    });

    storeValue = valueDataId;
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
