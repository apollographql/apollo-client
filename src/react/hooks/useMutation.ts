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
    client,
    mutation,
    options,
  });

  // TODO: Trying to assign these in a useEffect or useLayoutEffect breaks
  // higher-order components.
  {
    Object.assign(ref.current, { client, options, mutation });
  }

  const execute = useCallback((
    executeOptions: MutationFunctionOptions<
      TData,
      TVariables,
      TContext,
      TCache
    > = {}
  ) => {
    const {client, options, mutation} = ref.current;
    const baseOptions = { ...options, mutation };
    if (!ref.current.result.loading && !baseOptions.ignoreResults && ref.current.isMounted) {
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

    return client.mutate(clientOptions).then((response) => {
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
      ref.current.options?.onCompleted?.(response.data!, clientOptions);
      executeOptions.onCompleted?.(response.data!, clientOptions);
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

      if (ref.current.options?.onError || clientOptions.onError) {
        ref.current.options?.onError?.(error, clientOptions);
        executeOptions.onError?.(error, clientOptions);
        // TODO(brian): why are we returning this here???
        return { data: void 0, errors: error };
      }

      throw error;
    });
  }, []);

  const reset = useCallback(() => {
    if (ref.current.isMounted) {
      setResult({ called: false, loading: false, client });
    }
  }, []);

  useEffect(() => {
    ref.current.isMounted = true;

    return () => {
      ref.current.isMounted = false;
    };
  }, []);

  return [execute, { reset, ...result }];
}
