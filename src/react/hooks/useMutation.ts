import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
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
  const [result, setResult] = useState<Omit<MutationResult, 'reset'>>({
    called: false,
    loading: false,
    client,
  });

  const ref = useRef({
    result,
    mutationId: 0,
    isMounted: true,
    execute: null as null | MutationTuple<TData, TVariables, TContext, TCache>[0],
    client,
    mutation,
    options,
  });

  const execute = useMemo(() => {
    if (
      ref.current.execute != null &&
      ref.current.client === client &&
      equal(options, ref.current.options) &&
      equal(mutation, ref.current.mutation)) {
      return ref.current.execute;
    }

    ref.current.client = client;
    ref.current.options = options;
    ref.current.mutation = mutation;
    ref.current.execute = (
      executeOptions: MutationFunctionOptions<
        TData,
        TVariables,
        TContext,
        TCache
      > = {},
    ) => {
      const baseOptions = { ...options, mutation };
      if (!ref.current.result.loading && !baseOptions.ignoreResults) {
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
        baseOptions,
        executeOptions as any,
      );

      return client.mutate(clientOptions).then((response) =>{
        const { data, errors } = response;
        const error =
          errors && errors.length > 0
            ? new ApolloError({ graphQLErrors: errors })
            : void 0;

        if (
          mutationId === ref.current.mutationId &&
          !clientOptions.ignoreResults
        ) {
          const result = {
            called: true,
            loading: false,
            data,
            error,
            client,
          };

          if (ref.current.isMounted && !equal(ref.current.result, result)) {
            setResult(ref.current.result = result);
          }
        }

        baseOptions.onCompleted?.(response.data!);
        executeOptions.onCompleted?.(response.data!);
        return response;
      }).catch((error) => {
        if (
          mutationId === ref.current.mutationId &&
          ref.current.isMounted
        ) {
          const result = {
            loading: false,
            error,
            data: void 0,
            called: true,
            client,
          };

          if (!equal(ref.current.result, result)) {
            setResult(ref.current.result = result);
          }
        }

        if (baseOptions.onError || clientOptions.onError) {
          baseOptions.onError?.(error);
          executeOptions.onError?.(error);
          // TODO(brian): why are we returning this here???
          return { data: void 0, errors: error };
        }

        throw error;
      });
    };

    return ref.current.execute;
  }, [client, mutation, options]);

  const reset = useCallback(() => {
    setResult({ called: false, loading: false, client });
  }, []);

  useEffect(() => () => {
    ref.current.isMounted = false;
  }, []);

  return [execute, { reset, ...result }];
}
