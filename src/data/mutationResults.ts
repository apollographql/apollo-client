import {
  ApolloAction,
} from '../actions';

// This is part of the public API, people write these functions in `updateQueries`.
export type MutationQueryReducer<T> = (previousResult: Object, options: {
  mutationResult: T,
  queryName: string | null,
  queryVariables: Object,
}) => Object;

export type MutationQueryReducersMap<T = { [key: string]: any}> = {
  [queryName: string]: MutationQueryReducer<T>;
};

export type OperationResultReducer = (previousResult: Object, action: ApolloAction, variables: Object) => Object;

export type OperationResultReducerMap = {
  [queryId: string]: OperationResultReducer;
};
