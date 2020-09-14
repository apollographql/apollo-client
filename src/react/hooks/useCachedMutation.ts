import { DocumentNode } from 'graphql';

import { MutationHookOptions, MutationTuple } from '../types/types';
import { OperationVariables } from '../../core';

import { useMutation } from './useMutation';

/*
mutationName: is the name of the mutation
cacheId: Is the rootID of cache
 */

export function useCachedMutation<TData = any, TVariables = OperationVariables>(
  mutation: DocumentNode,
  fragment: DocumentNode,
  mutationName: string,
  cacheId: string,
  options?: MutationHookOptions<TData, TVariables>,
): MutationTuple<TData, TVariables> {
  //was did in this way to ensure that the user won't pass this prop;
  delete options?.update;

  return useMutation(mutation, {
    update(cache, { data }) {
      const response = (data as any)[mutationName];

      cache.modify({
        fields: {
          [cacheId]: (existingData = []) => {
            const newTweetRef = cache.writeFragment({
              data: response,
              fragment,
            });
            return [...existingData, newTweetRef];
          },
        },
      });
    },
    ...options,
  });
}
