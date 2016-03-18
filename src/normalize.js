/* eslint no-param-reassign: 0 */
// fix this by using immutablejs later

import { forOwn, isString, isNumber, isBoolean, isNull, isArray } from 'lodash';
import { parseFragmentIfString } from './parser';

export function normalizeResult({
  result,
  fragment,
  normalized = {},
}) {
  if (! isString(result.id) && ! isString(result.__data_id)) {
    throw new Error('Result passed to normalizeResult must have a string ID');
  }

  const resultDataId = result['__data_id'] || result.id;

  const normalizedRootObj = {};

  forOwn(result, (value, key) => {
    // If it's a scalar, just store it in the cache
    if (isString(value) || isNumber(value) || isBoolean(value) || isNull(value)) {
      normalizedRootObj[key] = value;
      return;
    }

    // If it's an array
    if (isArray(value)) {
      const thisIdList = [];

      value.forEach((item, index) => {
        if (! isString(item.id)) {
          item['__data_id'] = `${resultDataId}.${key}.${index}`;
        } else {
          item['__data_id'] = item.id;
        }

        thisIdList.push(item['__data_id']);

        normalizeResult({
          result: item,
          normalized,
        });
      });

      normalizedRootObj[key] = thisIdList;
      return;
    }

    // It's an object
    if (! isString(value.id)) {
      // Object doesn't have an ID, so store it with its field name and parent ID
      value['__data_id'] = `${resultDataId}.${key}`;
    } else {
      value['__data_id'] = value.id;
    }

    normalizedRootObj[key] = value['__data_id'];
    normalizeResult({
      result: value,
      normalized,
    });
  });

  normalized[resultDataId] = normalizedRootObj;

  return normalized;
}
