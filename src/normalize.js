/* eslint no-param-reassign: 0 */
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

export function normalizeResult({
  result,
  fragment,
  selectionSet,
  normalized = {},
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
    const fieldName = selection.name.value;
    const resultFieldName = selection.alias ? selection.alias.value : fieldName;
    const value = result[resultFieldName];

    if (isUndefined(value)) {
      throw new Error(`Can't find field ${resultFieldName} on result object ${resultDataId}.`);
    }

    // If it's a scalar, just store it in the cache
    if (isString(value) || isNumber(value) || isBoolean(value) || isNull(value)) {
      normalizedRootObj[fieldName] = value;
      return;
    }

    // If it's an array
    if (isArray(value)) {
      const thisIdList = [];

      value.forEach((item, index) => {
        if (! isString(item.id)) {
          item['__data_id'] = `${resultDataId}.${fieldName}.${index}`;
        } else {
          item['__data_id'] = item.id;
        }

        thisIdList.push(item['__data_id']);

        normalizeResult({
          result: item,
          normalized,
          selectionSet: selection.selectionSet,
        });
      });

      normalizedRootObj[fieldName] = thisIdList;
      return;
    }

    // It's an object
    if (! isString(value.id)) {
      // Object doesn't have an ID, so store it with its field name and parent ID
      value['__data_id'] = `${resultDataId}.${fieldName}`;
    } else {
      value['__data_id'] = value.id;
    }

    normalizedRootObj[fieldName] = value['__data_id'];

    normalizeResult({
      result: value,
      normalized,
      selectionSet: selection.selectionSet,
    });
  });

  normalized[resultDataId] = normalizedRootObj;

  return normalized;
}
