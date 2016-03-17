import { forOwn, isString, isNumber, isBoolean, isNull, isArray } from 'lodash';

export function normalizeResult(result, normalized = {}) {
  if (! isString(result.id) && ! isString(result.__data_id)) {
    throw new Error('Result passed to normalizeResult must have a string ID');
  }

  result.__data_id = result.__data_id || result.id;

  const thisValue = {};

  forOwn(result, (value, key) => {
    // If it's a scalar, just store it in the cache
    if (isString(value) || isNumber(value) || isBoolean(value) || isNull(value)) {
      thisValue[key] = value;
      return;
    }

    // If it's an array
    if (isArray(value)) {
      const thisIdList = [];

      value.forEach((item, index) => {
        if (! isString(item.id)) {
          item.__data_id = result.__data_id + '.' + key + '.' + index;
        } else {
          item.__data_id = item.id;
        }

        thisIdList.push(item.__data_id);

        normalizeResult(item, normalized);
      });

      thisValue[key] = thisIdList;
      return;
    }

    // It's an object
    if (! isString(value.id)) {
      // Object doesn't have an ID, so store it with its field name and parent ID
      value.__data_id = result.id + '.' + key;
    } else {
      value.__data_id = value.id;
    }

    normalizeResult(value, normalized);
  });

  normalized[result.__data_id] = thisValue;

  return normalized;
}
