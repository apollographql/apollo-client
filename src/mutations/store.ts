import {
  ApolloAction,
  isMutationInitAction,
  isMutationResultAction,
  isMutationErrorAction,
  isStoreResetAction,
} from '../actions';

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
  data: Object;
  mutationIds: Object;
}

const optimisticDefaultState = {
  data: {},
  mutationIds: {},
};

export function optimistic(
  previousState = optimisticDefaultState,
  action,
  config
): OptimisticStore {
  if (isMutationInitAction(action) && action.optimisticResponse) {
    const newState = {
      data: assign({}, previousState.data),
      mutationIds: assign({}, previousState.mutationIds),
    };
    const { dataIdFromObject } = config;
    const dataId = dataIdFromObject(action.optimisticResponse);

    newState.data[dataId] = action.optimisticResponse;
    newState.mutationIds[dataId] = action.mutationId;

    return newState;
  } else if (isMutationResultAction(action) && action.optimisticResponse) {
    let newState = previousState;
    const { dataIdFromObject } = config;
    const dataId = dataIdFromObject(action.optimisticResponse);
    const lastMutationId = newState.mutationIds[dataId];

    if (lastMutationId === action.mutationId) {
      newState = {
        data: assign({}, previousState.data),
        mutationIds: assign({}, previousState.mutationIds),
      };
      delete newState.data[dataId];
      delete newState.mutationIds[dataId];
    }

    return newState;
  }

  return previousState;
}

