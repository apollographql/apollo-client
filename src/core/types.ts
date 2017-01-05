import { DocumentNode } from 'graphql';
import {
  QueryStoreValue,
  NetworkStatus,
} from '../queries/store';

export interface SubscriptionOptions {
  document: DocumentNode;
  variables?: { [key: string]: any };
};

export type QueryListener = (queryStoreValue: QueryStoreValue) => void;

export type ApolloQueryResult = {
  data: any;
  loading: boolean;
  networkStatus: NetworkStatus;

  // This type is different from the GraphQLResult type because it doesn't include errors.
  // Those are thrown via the standard promise/observer catch mechanism.
};

// A result transformer is given the data that is to be returned from the store from a query or
// mutation, and can modify or observe it before the value is provided to your application.
//
// For watched queries, the transformer is only called when the data retrieved from the server is
// different from previous.
//
// If the transformer wants to mutate results (say, by setting the prototype of result data), it
// will likely need to be paired with a custom resultComparator.  By default, Apollo performs a
// deep equality comparsion on results, and skips those that are considered equal - reducing
// re-renders.
export type ResultTransformer = (resultData: ApolloQueryResult) => ApolloQueryResult;

// Controls how Apollo compares two query results and considers their equality.  Two equal results
// will not trigger re-renders.
export type ResultComparator = (result1: ApolloQueryResult, result2: ApolloQueryResult) => boolean;

export enum FetchType {
  normal = 1,
  refetch = 2,
  poll = 3,
}

export type IdGetter = (value: Object) => string;
