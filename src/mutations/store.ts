import {
  ApolloAction,
  isMutationInitAction,
  isMutationResultAction,
  isMutationErrorAction,
  isStoreResetAction,
} from '../actions';

import {
  data,
  NormalizedCache,
} from '../data/store';

import {
  SelectionSet,
} from 'graphql';

import {
  FragmentMap,
} from '../queries/getFromAST';

import assign = require('lodash.assign');

export interface MutationStore {
  [mutationId: string]: MutationStoreValue;
}

export interface MutationStoreValue {
  mutationString: string;
  mutation: SelectionSetWithRoot;
  variables: Object;
  loading: boolean;
  error: Error;
  fragmentMap: FragmentMap;
}

export interface SelectionSetWithRoot {
  id: string;
  typeName: string;
  selectionSet: SelectionSet;
}

export function mutations(
  previousState: MutationStore = {},
  action: ApolloAction
): MutationStore {
  if (isMutationInitAction(action)) {
    const newState = assign({}, previousState) as MutationStore;

    newState[action.mutationId] = {
      mutationString: action.mutationString,
      mutation: action.mutation,
      variables: action.variables,
      loading: true,
      error: null,
      fragmentMap: action.fragmentMap,
    };

    return newState;
  } else if (isMutationResultAction(action)) {
    const newState = assign({}, previousState) as MutationStore;

    newState[action.mutationId] = assign({}, previousState[action.mutationId], {
      loading: false,
      error: null,
    }) as MutationStoreValue;

    return newState;
  } else if (isMutationErrorAction(action)) {
    const newState = assign({}, previousState) as MutationStore;

    newState[action.mutationId] = assign({}, previousState[action.mutationId], {
      loading: false,
      error: action.error,
    }) as MutationStoreValue;
  } else if (isStoreResetAction(action)) {
    // if we are resetting the store, we no longer need information about the mutations
    // that are currently in the store so we can just throw them all away.
    return {};
  }

  return previousState;
}

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

