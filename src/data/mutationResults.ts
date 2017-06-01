import {
  ApolloAction,
} from '../actions';

// This is part of the public API, people write these functions in `updateQueries`.
export type MutationQueryReducer = (previousResult: Object, options: {
  mutationResult: Object,
  queryName: Object,
  queryVariables: Object,
  /**
   * A flag indicating whether we want to update the store or only the query cache (default true). Updating the store may result in
   * performance problems because of 2 reasons;
   * - writing updates to the store may take some time
   * - reassembling query cache data invalidated as a result of writing updates to the store may take some time
   *
   * If performance is a problem you can set updateStoreFlag to false. If you do this you may want to supply a custom update function to
   * the mutation as well as otherwise the query cache and the store won't be in-sync. Queries updated with updateStoreFlag set to false
   * won't be invalidated by a custom update function.
   */
   updateStoreFlag?: boolean;
}) => Object;
export type MutationQueryReducersMap = {
  [queryName: string]: MutationQueryReducer;
};
export type OperationResultReducer = (previousResult: Object, action: ApolloAction, variables: Object) => Object;
export type OperationResultReducerMap = {
  [queryId: string]: OperationResultReducer;
};
