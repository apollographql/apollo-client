/* Core */

export {
  ApolloClient,
  ApolloClientOptions,
  DefaultOptions
} from './ApolloClient';
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

/* Cache */

export { Transaction, ApolloCache } from './cache/core/cache';
export { Cache } from './cache/core/types/Cache';
export { DataProxy } from './cache/core/types/DataProxy';
export {
  InMemoryCache,
  InMemoryCacheConfig,
} from './cache/inmemory/inMemoryCache';
export { defaultDataIdFromObject } from './cache/inmemory/policies';
export * from './cache/inmemory/types';

/* React */

export { ApolloProvider } from './react/context/ApolloProvider';
export { ApolloConsumer } from './react/context/ApolloConsumer';
export {
  getApolloContext,
  resetApolloContext,
  ApolloContextValue
} from './react/context/ApolloContext';
export { useQuery } from './react/hooks/useQuery';
export { useLazyQuery } from './react/hooks/useLazyQuery';
export { useMutation } from './react/hooks/useMutation';
export { useSubscription } from './react/hooks/useSubscription';
export { useApolloClient } from './react/hooks/useApolloClient';
export { RenderPromises } from './react/ssr/RenderPromises';
export * from './react/types/types';
export * from './react/parser/parser';

/* Link */

export { empty } from './link/core/empty';
export { from } from './link/core/from';
export { split } from './link/core/split';
export { concat } from './link/core/concat';
export { execute } from './link/core/execute';
export { ApolloLink } from './link/core/ApolloLink';
export * from './link/core/types';
export {
  parseAndCheckHttpResponse,
  ServerParseError
} from './link/http/parseAndCheckHttpResponse';
export {
  serializeFetchParameter,
  ClientParseError
} from './link/http/serializeFetchParameter';
export {
  HttpOptions,
  fallbackHttpConfig,
  selectHttpOptionsAndBody,
  UriFunction
} from './link/http/selectHttpOptionsAndBody';
export { checkFetcher } from './link/http/checkFetcher';
export { createSignalIfSupported } from './link/http/createSignalIfSupported';
export { selectURI } from './link/http/selectURI';
export { createHttpLink } from './link/http/createHttpLink';
export { HttpLink } from './link/http/HttpLink';
export { fromError } from './link/utils/fromError';
export { ServerError, throwServerError } from './link/utils/throwServerError';

/* Utilities */

export { Observable } from './utilities/observables/Observable';

/* Supporting */

export { default as gql } from 'graphql-tag';
