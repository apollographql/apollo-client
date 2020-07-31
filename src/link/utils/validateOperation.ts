import { InvariantError } from 'ts-invariant';

import { GraphQLRequest } from '../core';

export function validateOperation(operation: GraphQLRequest): GraphQLRequest {
  const OPERATION_FIELDS = [
    'query',
    'operationName',
    'variables',
    'extensions',
    'context',
  ];
  for (let key of Object.keys(operation)) {
    if (OPERATION_FIELDS.indexOf(key) < 0) {
      throw new InvariantError(`illegal argument: ${key}`);
    }
  }

  return operation;
}
