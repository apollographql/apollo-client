import {
  ApolloLink,
  Operation,
  FetchResult,
  Observable,
} from 'apollo-link-core';
import { ApolloFetch, createApolloFetch } from 'apollo-fetch';

import { print } from 'graphql/language/printer';

/** Transforms Operation for into HTTP results.
 * context can include the headers property, which will be passed to the fetch function
 */
export default class HttpLink extends ApolloLink {
  private headers = {};
  private _fetch: ApolloFetch;

  constructor(fetchParams?: { uri?: string; fetch?: ApolloFetch }) {
    super();
    this._fetch =
      (fetchParams && fetchParams.fetch) ||
      createApolloFetch({ uri: fetchParams && fetchParams.uri });
    this._fetch.use((request, next) => {
      request.options.headers = {
        ...request.options.headers,
        ...this.headers,
      };
      next();
    });
  }

  public request(operation: Operation): Observable<FetchResult> | null {
    this.headers = (operation.context && operation.context.headers) || {};
    const request = {
      ...operation,
      query: print(operation.query),
    };

    return new Observable<FetchResult>(observer => {
      this._fetch(request)
        .then(data => {
          if (!observer.closed) {
            observer.next(data);
            observer.complete();
          }
        })
        .catch(error => {
          if (!observer.closed) {
            observer.error(error);
          }
        });
    });
  }
}
