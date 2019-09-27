import { Operation, RequestHandler, NextLink, FetchResult } from '../types';

import Observable from 'zen-observable-ts';

import { ApolloLink } from '../link';

export default class MockLink extends ApolloLink {
  constructor(handleRequest: RequestHandler = () => null) {
    super();
    this.request = handleRequest;
  }

  public request(
    operation: Operation,
    forward?: NextLink,
  ): Observable<FetchResult> | null {
    throw Error('should be overridden');
  }
}
