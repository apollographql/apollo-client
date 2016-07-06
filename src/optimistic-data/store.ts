import {
  ApolloAction,
  isMutationInitAction,
  isMutationResultAction,
} from '../actions';

import {
  data,
  NormalizedCache,
} from '../data/store';

export interface OptimisticStore {
  data: NormalizedCache;
  mutationIds: any;
}

const optimisticDefaultState = {
  data: {} as NormalizedCache,
  mutationIds: [],
};

export function optimistic(
  previousState = optimisticDefaultState,
  action,
  queriesState,
  mutationsState,
  dataState,
  config
): OptimisticStore {
  if (isMutationInitAction(action) && action.optimisticResponse) {
    const fakeMutationResultAction = {
      type: 'APOLLO_MUTATION_RESULT',
      result: { data: action.optimisticResponse },
      mutationId: action.mutationId,
    } as ApolloAction;

    const fakeDataResultState = data(previousState.data,
      fakeMutationResultAction,
      queriesState,
      mutationsState,
      config);

    const newState = {
      data: fakeDataResultState,
      mutationIds: [...previousState.mutationIds],
    };
    newState.mutationIds.push(action.mutationId);

    return newState;
  } else if (isMutationResultAction(action) && action.optimisticResponse) {
    let newState;
    const newMutationIds = previousState.mutationIds.filter((id) => {
      return id !== action.mutationId;
    });

    // throw away if no outstanding mutation requests
    if (newMutationIds.length === 0) {
      newState = {
        data: {} as NormalizedCache,
        mutationIds: [],
      };
    } else {
      newState = {
        data: previousState.data,
        mutationIds: newMutationIds,
      };
    }

    return newState;
  }

  return previousState;
}
