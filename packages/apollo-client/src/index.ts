export { print as printAST } from 'graphql/language/printer';

export {
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions,
  ApolloCurrentResult,
} from './core/ObservableQuery';
export {
  QueryBaseOptions,
  QueryOptions,
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
  FetchPolicy,
  ErrorPolicy,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  MutationUpdaterFn,
} from './core/watchQueryOptions';
export { NetworkStatus } from './core/networkStatus';
export * from './core/types';

export { ApolloError } from './errors/ApolloError';

import ApolloClient, {
  ApolloClientOptions,
  DefaultOptions,
} from './ApolloClient';

export { ApolloClientOptions, DefaultOptions };

// export the client as both default and named
export { ApolloClient };
export default ApolloClient;
