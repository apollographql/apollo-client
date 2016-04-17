import {
  ApolloAction,
  isMutationInitAction,
  isMutationResultAction,
} from '../actions';

import {
  SelectionSet,
} from 'graphql';

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
    };

    return newState;
  } else if (isMutationResultAction(action)) {
    const newState = assign({}, previousState) as MutationStore;

    newState[action.mutationId] = assign({}, previousState[action.mutationId], {
      loading: false,
      error: null,
    }) as MutationStoreValue;

    return newState;
  }

  return previousState;
}
