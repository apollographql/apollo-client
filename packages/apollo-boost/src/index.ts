/* necessary for backward compat */
export * from 'apollo-client';
export * from 'apollo-link';
export * from 'apollo-cache-inmemory';

import { Operation, ApolloLink, Observable } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { withClientState, ClientStateConfig } from 'apollo-link-state';
import { onError, ErrorLink } from 'apollo-link-error';

import { ApolloCache } from 'apollo-cache';
import { InMemoryCache, CacheResolverMap } from 'apollo-cache-inmemory';
import gql from 'graphql-tag';
import ApolloClient from 'apollo-client';

export { gql, InMemoryCache, HttpLink };

export interface PresetConfig {
  request?: (operation: Operation) => Promise<void>;
  uri?: string;
  credentials?: string;
  headers?: any;
  fetchOptions?: HttpLink.Options;
  clientState?: ClientStateConfig;
  onError?: ErrorLink.ErrorHandler;
  cacheRedirects?: CacheResolverMap;
  cache?: ApolloCache<any>;
}

export default class DefaultClient<TCache> extends ApolloClient<TCache> {
  constructor(config: PresetConfig = {}) {
    const {
      request,
      uri,
      credentials,
      headers,
      fetchOptions,
      clientState,
      cacheRedirects,
      onError: errorCallback,
    } = config;

    let { cache } = config;

    if (cache && cacheRedirects) {
      throw new Error(
        'Incompatible cache configuration. If providing `cache` then ' +
          'configure the provided instance with `cacheRedirects` instead.',
      );
    }

    if (!cache) {
      cache = cacheRedirects
        ? new InMemoryCache({ cacheRedirects })
        : new InMemoryCache();
    }

    const stateLink = clientState
      ? withClientState({ ...clientState, cache })
      : false;

    const errorLink = errorCallback
      ? onError(errorCallback)
      : onError(({ graphQLErrors, networkError }) => {
          if (graphQLErrors) {
            graphQLErrors.map(({ message, locations, path }) =>
              // tslint:disable-next-line
              console.log(
                `[GraphQL error]: Message: ${message}, Location: ` +
                  `${locations}, Path: ${path}`,
              ),
            );
          }
          if (networkError) {
            // tslint:disable-next-line
            console.log(`[Network error]: ${networkError}`);
          }
        });

    const requestHandler = request
      ? new ApolloLink(
          (operation, forward) =>
            new Observable(observer => {
              let handle: any;
              Promise.resolve(operation)
                .then(oper => request(oper))
                .then(() => {
                  handle = forward(operation).subscribe({
                    next: observer.next.bind(observer),
                    error: observer.error.bind(observer),
                    complete: observer.complete.bind(observer),
                  });
                })
                .catch(observer.error.bind(observer));

              return () => {
                if (handle) {
                  handle.unsubscribe();
                }
              };
            }),
        )
      : false;

    const httpLink = new HttpLink({
      uri: uri || '/graphql',
      fetchOptions: fetchOptions || {},
      credentials: credentials || 'same-origin',
      headers: headers || {},
    });

    const link = ApolloLink.from([
      errorLink,
      requestHandler,
      stateLink,
      httpLink,
    ].filter(x => !!x) as ApolloLink[]);

    // super hacky, we will fix the types eventually
    super({ cache, link } as any);
  }
}
