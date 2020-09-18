import {DocumentNode} from 'graphql';

import {CachedMutationHookOptions, MutationTuple} from '../types/types';
import {OperationVariables} from '../../core';

import {useMutation} from './useMutation';

export function useCachedMutation<TData = any, TVariables = OperationVariables>(
  mutation: DocumentNode,
  fragment: DocumentNode,
  options: CachedMutationHookOptions<TData, TVariables>,
): MutationTuple<TData, TVariables> {
  //was did in this way to ensure that the user won't pass this prop;
  delete options?.update;

  const {mutationName, rootCacheId} = options;

  return useMutation(mutation, {
    update(cache, {data}) {
      const response = (data as any)[mutationName];

      cache.modify({
        fields: {
          [rootCacheId]: (existingData = []) => {
            const newRef = cache.writeFragment({
              data: response,
              fragment,
            });

            if (options?.updateKey) {
              if (typeof existingData === 'object') {
                return {
                  ...existingData,
                  [options.updateKey]: [
                    newRef,
                    ...existingData[options.updateKey],
                  ],
                };
              }
            }
            return [...existingData, newRef];
          },
        },
      });
    },
    ...options,
  });
}
