import { GraphQLRequest, RequestHandler } from './types';

import { ApolloLink, FunctionLink } from './link';

import Observable from 'zen-observable-ts';

export function validateLink(link: ApolloLink): ApolloLink {
  if (link instanceof ApolloLink && typeof link.request === 'function') {
    return link;
  } else {
    throw new LinkError(
      'Link does not extend ApolloLink and implement request',
      link,
    );
  }
}

export function validateOperation(operation: GraphQLRequest): GraphQLRequest {
  const OPERATION_FIELDS = ['query', 'operationName', 'variables', 'context'];
  for (let key of Object.keys(operation)) {
    if (OPERATION_FIELDS.indexOf(key) < 0) {
      throw new Error(`illegal argument: ${key}`);
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

export function toLink(link: ApolloLink | RequestHandler): ApolloLink {
  if (typeof link === 'function') {
    return new FunctionLink(link);
  } else {
    return link as ApolloLink;
  }
}

export function isTerminating(link: ApolloLink): boolean {
  return link.request.length <= 1;
}

export function makePromise<R>(observable: Observable<R>): Promise<R> {
  let completed = false;
  return new Promise<R>((resolve, reject) => {
    observable.subscribe({
      next: data => {
        if (completed) {
          console.warn(
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
