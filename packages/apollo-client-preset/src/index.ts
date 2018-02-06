/* necessary for backward compat */
export * from 'apollo-client';
export * from 'apollo-link';
export * from 'apollo-cache-inmemory';

import { Operation, ApolloLink } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { ErrorLink } from 'apollo-link-error';
import { withClientState, ClientStateConfig } from 'apollo-link-state';
import { setContext, ContextSetter } from 'apollo-link-context';
import { onError } from 'apollo-link-error';
import { InMemoryCache, NormalizedCache } from 'apollo-cache-inmemory';

import gql from 'graphql-tag';
import ApolloClient, { ApolloClientOptions } from 'apollo-client';

export { gql, InMemoryCache, HttpLink };

export interface PresetConfig {
  request?: (operation: Operation) => any;
  uri?: string;
  fetchOptions?: HttpLink.Options;
  clientState?: ClientStateConfig;
  errorHandler?: ErrorLink.ErrorHandler;
  context?: ContextSetter;
}

export default class DefaultClient<
  TCache = NormalizedCache
> extends ApolloClient<TCache> {
  constructor(config: PresetConfig) {
    const cache = new InMemoryCache();

    const forwardLink = new ApolloLink((operation, forward) =>
      forward(operation),
    );

    const stateLink = config.clientState
      ? withClientState({ ...config.clientState, cache })
      : forwardLink;

    const contextLink = config.context
      ? setContext(config.context)
      : forwardLink;

    const errorLink = config.errorHandler
      ? onError(config.errorHandler)
      : forwardLink;

    const requestHandler = new ApolloLink((operation, forward) => {
      if (config.request) {
        config.request(operation);
      }
      return forward(operation);
    });

    const httpLink = new HttpLink({
      uri: config.uri || '/graphql',
      fetchOptions: config.fetchOptions || {},
      credentials: 'same-origin',
    });

    super({
      cache,
      link: ApolloLink.from([
        errorLink,
        requestHandler,
        contextLink,
        stateLink,
        httpLink,
      ]),
    } as ApolloClientOptions<TCache>);
  }
}
