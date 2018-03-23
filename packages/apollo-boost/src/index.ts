/* necessary for backward compat */
export * from 'apollo-client';
export * from 'apollo-link';
export * from 'apollo-cache-inmemory';

import { Operation, ApolloLink, Observable } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { withClientState, ClientStateConfig } from 'apollo-link-state';
import { onError, ErrorLink } from 'apollo-link-error';

import { InMemoryCache, CacheResolverMap } from 'apollo-cache-inmemory';
import gql from 'graphql-tag';
import ApolloClient from 'apollo-client';

export { gql, InMemoryCache, HttpLink };

export interface PresetConfig {
  request?: (operation: Operation) => Promise<void>;
  uri?: string;
  fetchOptions?: HttpLink.Options;
  clientState?: ClientStateConfig;
  onError?: ErrorLink.ErrorHandler;
  cacheRedirects?: CacheResolverMap;
}

export default class DefaultClient<TCache> extends ApolloClient<TCache> {
  constructor(config: PresetConfig) {
    const cache =
      config && config.cacheRedirects
        ? new InMemoryCache({ cacheRedirects: config.cacheRedirects })
        : new InMemoryCache();

    const stateLink =
      config && config.clientState
        ? withClientState({ ...config.clientState, cache })
        : false;

    const errorLink =
      config && config.onError
        ? onError(config.onError)
        : onError(({ graphQLErrors, networkError }) => {
            if (graphQLErrors)
              graphQLErrors.map(({ message, locations, path }) =>
                console.log(
                  `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
                ),
              );
            if (networkError) console.log(`[Network error]: ${networkError}`);
          });

    const requestHandler =
      config && config.request
        ? new ApolloLink((operation, forward) =>
            new Observable(observer => {
              let handle: any;
              Promise.resolve(operation)
                .then(oper => config.request(oper))
                .then(() => {
                  handle = forward(operation).subscribe({
                    next: observer.next.bind(observer),
                    error: observer.error.bind(observer),
                    complete: observer.complete.bind(observer),
                  });
                })
                .catch(observer.error.bind(observer));

              return () => {
                if (handle) handle.unsubscribe;
              };
            })
          )
        : false;

    const httpLink = new HttpLink({
      uri: (config && config.uri) || '/graphql',
      fetchOptions: (config && config.fetchOptions) || {},
      credentials: 'same-origin',
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
