import {
  ApolloAction,
} from '../actions';

// This is part of the public API, people write these functions in `updateQueries`.
export type MutationQueryReducer = (previousResult: Object, options: {
  mutationResult: Object,
  queryName: Object,
  queryVariables: Object,
}) => Object;

export type MutationQueryReducersMap = {
  [queryName: string]: MutationQueryReducer;
};

export type OperationResultReducer = (previousResult: Object, action: ApolloAction, variables: Object) => Object;

export type OperationResultReducerMap = {
  [queryId: string]: OperationResultReducer;
};
