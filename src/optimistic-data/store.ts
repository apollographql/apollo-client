import {
  ApolloAction,
  isMutationInitAction,
  isMutationResultAction,
  isMutationErrorAction,
} from '../actions';

import {
  data,
  NormalizedCache,
} from '../data/store';

import {
  getDataWithOptimisticResults,
  Store,
} from '../store';

import assign = require('lodash.assign');

// Currently every OptimisticStore stack's element contains an entirely new copy of `data`
// This could be optimized with a copy-on-write data structure like immutable.js
export type OptimisticStore = {
  mutationId: string,
  data: NormalizedCache,
}[];

const optimisticDefaultState = [];

export function optimistic(
  previousState = optimisticDefaultState,
  action,
  store,
  config
): OptimisticStore {
  if (isMutationInitAction(action) && action.optimisticResponse) {
    const fakeMutationResultAction = {
      type: 'APOLLO_MUTATION_RESULT',
      result: { data: action.optimisticResponse },
      mutationId: action.mutationId,
      optimisticResponse: null,
      resultBehaviors: action.resultBehaviors,
    } as ApolloAction;

    const fakeStore = assign({}, store, { optimistic: previousState }) as Store;
    const fakeDataResultState = data(
      getDataWithOptimisticResults(fakeStore),
      fakeMutationResultAction,
      store.queries,
      store.mutations,
      config
    );

    const optimisticState = {
      data: fakeDataResultState,
      mutationId: action.mutationId,
    };

    const newState = [...previousState, optimisticState];

    return newState;
  } else if ((isMutationErrorAction(action) || isMutationResultAction(action))
               && action.optimisticResponse) {
    // throw away optimistic changes of that particular mutation
    const newState = previousState.filter(
      (change) => change.mutationId !== action.mutationId);

    return newState;
  }

  return previousState;
}
