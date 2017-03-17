import {
  ApolloAction,
  isMutationInitAction,
  isMutationResultAction,
  isMutationErrorAction,
  isStoreResetAction,
} from '../actions';

import {
  SelectionSetNode,
} from 'graphql';

export interface MutationStore {
  [mutationId: string]: MutationStoreValue;
}

export interface MutationStoreValue {
  mutationString: string;
  variables: Object;
  loading: boolean;
  error: Error | null;
}

export interface SelectionSetWithRoot {
  id: string;
  typeName: string;
  selectionSet: SelectionSetNode;
}

export function mutations(
  previousState: MutationStore = {},
  action: ApolloAction,
): MutationStore {
  if (isMutationInitAction(action)) {
    const newState = { ...previousState } as MutationStore;

    newState[action.mutationId] = {
      mutationString: action.mutationString,
      variables: action.variables,
      loading: true,
      error: null,
    };

    return newState;
  } else if (isMutationResultAction(action)) {
    const newState = { ...previousState } as MutationStore;

    newState[action.mutationId] = {
      ...previousState[action.mutationId],
      loading: false,
      error: null,
    } as MutationStoreValue;

    return newState;
  } else if (isMutationErrorAction(action)) {
    const newState = { ...previousState } as MutationStore;

    newState[action.mutationId] = {
      ...previousState[action.mutationId],
      loading: false,
      error: action.error,
    } as MutationStoreValue;
  } else if (isStoreResetAction(action)) {
    // if we are resetting the store, we no longer need information about the mutations
    // that are currently in the store so we can just throw them all away.
    return {};
  }

  return previousState;
}
