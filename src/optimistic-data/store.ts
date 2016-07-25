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
import pick = require('lodash.pick');

// a stack of patches of new or changed documents
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
      resultBehaviors: action.resultBehaviors,
      mutation: action.mutation,
      fragmentMap: action.fragmentMap,
      variables: action.variables,
    } as ApolloAction;

    const fakeStore = assign({}, store, { optimistic: previousState }) as Store;
    const optimisticData = getDataWithOptimisticResults(fakeStore);
    const fakeDataResultState = data(
      optimisticData,
      fakeMutationResultAction,
      config
    );

    const changedKeys = Object.keys(fakeDataResultState).filter(
      key => optimisticData[key] !== fakeDataResultState[key]);
    const patch = pick(fakeDataResultState, changedKeys);

    const optimisticState = {
      data: patch,
      mutationId: action.mutationId,
    };

    const newState = [...previousState, optimisticState];

    return newState;
  } else if ((isMutationErrorAction(action) || isMutationResultAction(action))
               && previousState.some(change => change.mutationId === action.mutationId)) {
    // throw away optimistic changes of that particular mutation
    const newState = previousState.filter(
      (change) => change.mutationId !== action.mutationId);

    return newState;
  }

  return previousState;
}
