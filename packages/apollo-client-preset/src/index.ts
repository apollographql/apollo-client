/* necessary for backward compat */
export * from 'apollo-client';
export * from 'apollo-link';
export * from 'apollo-cache-inmemory';

import { Operation, ApolloLink, Observable } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { withClientState, ClientStateConfig } from 'apollo-link-state';
import { onError, ErrorLink } from 'apollo-link-error';
import { InMemoryCache, NormalizedCache } from 'apollo-cache-inmemory';

import gql from 'graphql-tag';
import ApolloClient, { ApolloClientOptions } from 'apollo-client';

export { gql, InMemoryCache, HttpLink };

export interface PresetConfig {
  request?: (operation: Operation) => Promise<void>;
  uri?: string;
  fetchOptions?: HttpLink.Options;
  clientState?: ClientStateConfig;
  onError?: ErrorLink.ErrorHandler;
}

export default class DefaultClient<
  TCache = NormalizedCache
> extends ApolloClient<TCache> {
  constructor(config: PresetConfig) {
    const cache = new InMemoryCache();

    const stateLink = config.clientState
      ? withClientState({ ...config.clientState, cache })
      : false;

    const errorLink = config.onError
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

    const requestHandler = config.request
      ? new ApolloLink((operation, forward) => {
          const { ...request } = operation;

          return new Observable(observer => {
            let handle: any;
            Promise.resolve(request)
              .then(req => config.request(req))
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
          });
        })
      : false;

    const httpLink = new HttpLink({
      uri: config.uri || '/graphql',
      fetchOptions: config.fetchOptions || {},
      credentials: 'same-origin',
    });

    const link = ApolloLink.from([
      errorLink,
      requestHandler,
      stateLink,
      httpLink,
    ].filter(x => !!x) as ApolloLink[]);

    super({ cache, link } as ApolloClientOptions<TCache>);
  }
}
