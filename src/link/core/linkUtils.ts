import Observable from 'zen-observable';
import { invariant, InvariantError } from 'ts-invariant';

import { GraphQLRequest, Operation } from './types';
import { ApolloLink } from './link';
import { getOperationName } from '../../utilities/getFromAST';

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

export class LinkError extends Error {
  public link: ApolloLink;
  constructor(message?: string, link?: ApolloLink) {
    super(message);
    this.link = link;
  }
}

export function isTerminating(link: ApolloLink): boolean {
  return link.request.length <= 1;
}

export function toPromise<R>(observable: Observable<R>): Promise<R> {
  let completed = false;
  return new Promise<R>((resolve, reject) => {
    observable.subscribe({
      next: data => {
        if (completed) {
          invariant.warn(
            `Promise Wrapper does not support multiple results from Observable`,
          );
        } else {
          completed = true;
          resolve(data);
        }
      },
      error: reject,
    });
  });
}

export function fromPromise<T>(promise: Promise<T>): Observable<T> {
  return new Observable<T>(observer => {
    promise
      .then((value: T) => {
        observer.next(value);
        observer.complete();
      })
      .catch(observer.error.bind(observer));
  });
}

export function fromError<T>(errorValue: any): Observable<T> {
  return new Observable<T>(observer => {
    observer.error(errorValue);
  });
}

export function transformOperation(operation: GraphQLRequest): GraphQLRequest {
  const transformedOperation: GraphQLRequest = {
    variables: operation.variables || {},
    extensions: operation.extensions || {},
    operationName: operation.operationName,
    query: operation.query,
  };

  // best guess at an operation name
  if (!transformedOperation.operationName) {
    transformedOperation.operationName =
      typeof transformedOperation.query !== 'string'
        ? getOperationName(transformedOperation.query)
        : '';
  }

  return transformedOperation as Operation;
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

export function getKey(operation: GraphQLRequest) {
  // XXX We're assuming here that query and variables will be serialized in
  // the same order, which might not always be true.
  const { query, variables, operationName } = operation;
  return JSON.stringify([operationName, query, variables]);
}
