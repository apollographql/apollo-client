import {
  ApolloAction,
  isMutationInitAction,
  isMutationResultAction,
} from '../actions';

import {
  data,
  NormalizedCache,
} from '../data/store';

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
    } as ApolloAction;

    const fakeDataResultState = data(
      {} as NormalizedCache,
      fakeMutationResultAction,
      store.queries,
      store.mutations,
      config
    );

    const optimisticPatch = {
      data: fakeDataResultState,
      mutationId: action.mutationId,
    };

    const newState = [...previousState, optimisticPatch];

    return newState;
  } else if (isMutationResultAction(action) && action.optimisticResponse) {
    // throw away optimistic changes of that particular mutation
    const newState = previousState.filter(
      (change) => change.mutationId !== action.mutationId);

    return newState;
  }

  return previousState;
}
