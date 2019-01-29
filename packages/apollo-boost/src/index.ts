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

export { gql, HttpLink };

export interface PresetConfig {
  request?: (operation: Operation) => Promise<void>;
  uri?: string;
  credentials?: string;
  headers?: any;
  fetch?: GlobalFetch['fetch'];
  fetchOptions?: HttpLink.Options;
  clientState?: ClientStateConfig;
  onError?: ErrorLink.ErrorHandler;
  cacheRedirects?: CacheResolverMap;
  cache?: ApolloCache<any>;
  name?: string;
  version?: string;
}

// Yes, these are the exact same as the `PresetConfig` interface. We're
// defining these again so they can be used to verify that valid config
// options are being used in the `DefaultClient` constructor, for clients
// that aren't using Typescript. This duplication is unfortunate, and at
// some point can likely be adjusted so these items are inferred from
// the `PresetConfig` interface using a Typescript transform at compilation
// time. Unfortunately, TS transforms with rollup don't appear to be quite
// working properly, so this will have to be re-visited at some point.
// For now, when updating the properties of the `PresetConfig` interface,
// please also update this constant.
const PRESET_CONFIG_KEYS = [
  'request',
  'uri',
  'credentials',
  'headers',
  'fetch',
  'fetchOptions',
  'clientState',
  'onError',
  'cacheRedirects',
  'cache',
  'name',
  'version',
];

export default class DefaultClient<TCache> extends ApolloClient<TCache> {
  constructor(config: PresetConfig = {}) {
    if (config) {
      const diff = Object.keys(config).filter(
        key => PRESET_CONFIG_KEYS.indexOf(key) === -1,
      );

      if (diff.length > 0) {
        console.warn(
          'ApolloBoost was initialized with unsupported options: ' +
            `${diff.join(' ')}`,
        );
      }
    }

    const {
      request,
      uri,
      credentials,
      headers,
      fetch,
      fetchOptions,
      clientState,
      cacheRedirects,
      onError: errorCallback,
      name,
      version,
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
      fetch,
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
    super({ cache, link, name, version } as any);
  }
}
