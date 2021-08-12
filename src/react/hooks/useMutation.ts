import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import {
  MutationFunctionOptions,
  MutationHookOptions,
  MutationResult,
  MutationTuple,
} from '../types/types';

import {
  ApolloCache,
  DefaultContext,
  mergeOptions,
  OperationVariables,
} from '../../core';
import { equal } from '@wry/equality';
import { DocumentType, verifyDocumentType } from '../parser';
import { ApolloError } from '../../errors';
import { FetchResult } from '../../link/core';
import { useApolloClient } from './useApolloClient';

export function useMutation<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
>(
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: MutationHookOptions<TData, TVariables, TContext>,
): MutationTuple<TData, TVariables, TContext, TCache> {
  const client = useApolloClient(options?.client);
  verifyDocumentType(mutation, DocumentType.Mutation);
  const [result, setResult] = useState<MutationResult>({
    called: false,
    loading: false,
    client,
  });

  const ref = useRef({
    result,
    mutationId: 0,
    isMounted: true,
  });

  const execute = useCallback((
    executeOptions: MutationFunctionOptions<
      TData,
      TVariables,
      TContext,
      TCache
    > = {},
  ) => {
    if (!ref.current.result.loading && !options?.ignoreResults) {
      setResult(ref.current.result = {
        loading: true,
        error: void 0,
        data: void 0,
        called: true,
        client,
      });
    }

    const mutationId = ++ref.current.mutationId;
    const clientOptions = mergeOptions(
      { ...options, mutation },
      executeOptions as any,
    );
    return client.mutate(clientOptions)
      .then((response: FetchResult<TData>) => {
        const { data, errors } = response;
        const error =
          errors && errors.length > 0
            ? new ApolloError({ graphQLErrors: errors })
            : void 0;

        if (mutationId === ref.current.mutationId && !options?.ignoreResults) {
          const result = {
            called: true,
            loading: false,
            data,
            error,
            client,
          };

          if (
            ref.current.isMounted &&
            !equal(ref.current.result, result)
          ) {
            ref.current.result = result;
            setResult(result);
          }
        }

        options?.onCompleted?.(data!);
        return response;
      }).catch((error) => {
        if (mutationId === ref.current.mutationId) {
          const result = {
            loading: false,
            error,
            data: void 0,
            called: true,
            client,
          };

          if (
            ref.current.isMounted &&
            !equal(ref.current.result, result)
          ) {
            ref.current.result = result;
            setResult(result);
          }
        }

        if (options?.onError) {
          options.onError(error);
          // TODO(brian): why are we returning this here???
          return { data: void 0, errors: error };
        }

        throw error;
      });
  }, [client, options, mutation]);

  useEffect(() => () => {
    ref.current.isMounted = false;
  }, []);

  return [execute, result];
}
