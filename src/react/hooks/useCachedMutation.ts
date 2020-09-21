import {DocumentNode} from 'graphql';

import {CachedMutationHookOptions, MutationTuple} from '../types/types';
import {OperationVariables} from '../../core';

import {useMutation} from './useMutation';

export function useCachedMutation<TData = any, TVariables = OperationVariables>(
  mutation: DocumentNode,
  fragment: DocumentNode,
  options: CachedMutationHookOptions<TData, TVariables>,
): MutationTuple<TData, TVariables> {
  //It was done in this way to ensure that the user won't pass this prop;
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
                const key = options.updateKey;

                if (!existingData[key].find((data: any) => data.__ref === newRef?.__ref)) {
                  return {
                    ...existingData,
                    [key]: [
                      newRef,
                      ...existingData[key],
                    ],
                  };
                } else {
                  const newData = existingData[key].filter((data: any) => data.__ref !== newRef?.__ref);
                  return {
                    ...existingData,
                    [key]: [
                      newRef,
                      ...newData,
                    ],
                  };
                }
              }
            }

            if (!existingData.find((data: any) => data.__ref === newRef?.__ref)) {
              return [...existingData, newRef]
            } else {
              const newData = existingData.filter((data: any) => data.__ref !== newRef?.__ref);
              return [...newData, newRef];
            }
          },
        },
      });
    },
    ...options,
  });
}
