export { print as printAST } from 'graphql/language/printer';

export {
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions,
} from './core/ObservableQuery';
export {
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
  FetchPolicy,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  MutationUpdaterFn,
} from './core/watchQueryOptions';
export { NetworkStatus } from './core/networkStatus';
export * from './core/types';

export { ApolloError } from './errors/ApolloError';

import ApolloClient from './ApolloClient';

// export the client as both default and named
export { ApolloClient };
export default ApolloClient;
