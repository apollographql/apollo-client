export {
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions,
  ApolloCurrentQueryResult,
} from './core/ObservableQuery';

export {
  QueryBaseOptions,
  QueryOptions,
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
  FetchPolicy,
  WatchQueryFetchPolicy,
  ErrorPolicy,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  MutationUpdaterFn,
} from './core/watchQueryOptions';

export { NetworkStatus } from './core/networkStatus';

export * from './core/types';

export {
  Resolver,
  FragmentMatcher as LocalStateFragmentMatcher,
} from './core/LocalState';

export { isApolloError, ApolloError } from './errors/ApolloError';

import ApolloClient, {
  ApolloClientOptions,
  DefaultOptions,
} from './ApolloClient';
export { ApolloClientOptions, DefaultOptions };

// Export the client as both default and named.
export { ApolloClient };
export default ApolloClient;

export * from './cache/core';
export * from './cache/inmemory';

export * from './react';

export * from './link/core';
export * from './link/http';
export * from './link/utils';

export { default as Observable } from 'zen-observable';

export * from './utilities';
