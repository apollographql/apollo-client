import { createStore as createReduxStore } from 'redux';
import { forOwn, isString, isNumber, isBoolean } from 'lodash';

import {
  RECEIVE_RESULT,
} from './actionTypes';

export function createStore() {
  return {
    reduxStore: createReduxStore(graphQLReducer),
  }
}

const initialState = {};
export function graphQLReducer(previousState = initialState, action) {
  switch (action.type) {
    case RECEIVE_RESULT:
      return saveResultToCache(state, action.result);
    default:
      return state;
  }
}

function saveResultToCache(previousState, result) {
  const normalizedResult = normalizeResult(result);
}

export function normalizeResult(result) {
  if (! isString(result.id)) {
    throw new Error('Result passed to normalizeResult must have a string ID');
  }

  const normalized = {};

  const thisValue = {};

  forOwn(result, (value, key) => {
    // If it's a scalar, just store it in the cache
    if (isString(value) || isNumber(value) || isBoolean(value)) {
      thisValue[key] = value;
      return;
    }
  });

  normalized[result.id] = thisValue;

  return normalized;
}
