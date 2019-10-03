import { GraphQLRequest, Operation } from '../core/types';

function getKey(operation: GraphQLRequest) {
  // XXX We're assuming here that query and variables will be serialized in
  // the same order, which might not always be true.
  const { query, variables, operationName } = operation;
  return JSON.stringify([operationName, query, variables]);
}

export function createOperation(
  starting: any,
  operation: GraphQLRequest,
): Operation {
  let context = { ...starting };
  const setContext = (next: any) => {
    if (typeof next === 'function') {
      context = { ...context, ...next(context) };
    } else {
      context = { ...context, ...next };
    }
  };
  const getContext = () => ({ ...context });

  Object.defineProperty(operation, 'setContext', {
    enumerable: false,
    value: setContext,
  });

  Object.defineProperty(operation, 'getContext', {
    enumerable: false,
    value: getContext,
  });

  Object.defineProperty(operation, 'toKey', {
    enumerable: false,
    value: () => getKey(operation),
  });

  return operation as Operation;
}
