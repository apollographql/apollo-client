import { forOwn, isString, isNumber, isBoolean, isNull, isArray } from 'lodash';

export function normalizeResult(result, normalized = {}) {
  if (! isString(result.id)) {
    throw new Error('Result passed to normalizeResult must have a string ID');
  }

  const thisValue = {};

  forOwn(result, (value, key) => {
    // If it's a scalar, just store it in the cache
    if (isString(value) || isNumber(value) || isBoolean(value) || isNull(value)) {
      thisValue[key] = value;
      return;
    }

    // If it's an array
    if (isArray(value)) {
      throw new Error('Arrays not implemented!');
    }

    // It's an object
    if (! isString(value.id)) {
      // Object doesn't have an ID, so store it with its field name and parent ID
      value.id = result.id + '.' + key;
    }

    normalizeResult(value, normalized);
  });

  normalized[result.id] = thisValue;

  return normalized;
}
