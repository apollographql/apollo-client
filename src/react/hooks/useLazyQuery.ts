import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { OperationVariables } from '../../core';
import { mergeOptions } from '../../utilities';
import {
  LazyQueryHookOptions,
  LazyQueryResultTuple,
  QueryResult,
} from '../types/types';
import { useInternalState } from './useQuery';
import { useApolloClient } from './useApolloClient';

// The following methods, when called will execute the query, regardless of
// whether the useLazyQuery execute function was called before.
const EAGER_METHODS = [
  'refetch',
  'reobserve',
  'fetchMore',
  'updateQuery',
  'startPolling',
  'subscribeToMore',
] as const;

export function useLazyQuery<TData = any, TVariables extends OperationVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: LazyQueryHookOptions<TData, TVariables>
): LazyQueryResultTuple<TData, TVariables> {
  const abortControllersRef = useRef(new Set<AbortController>());

  const execOptionsRef = useRef<Partial<LazyQueryHookOptions<TData, TVariables>>>();
  const merged = execOptionsRef.current ? mergeOptions(options, execOptionsRef.current) : options;

  const internalState = useInternalState<TData, TVariables>(
    useApolloClient(options && options.client),
    merged?.query ?? query
  );

  const useQueryResult = internalState.useQuery({
    ...merged,
    skip: !execOptionsRef.current,
  });

  const initialFetchPolicy =
    useQueryResult.observable.options.initialFetchPolicy ||
    internalState.getDefaultFetchPolicy();

  const result: QueryResult<TData, TVariables> =
    Object.assign(useQueryResult, {
      called: !!execOptionsRef.current,
    });

  // We use useMemo here to make sure the eager methods have a stable identity.
  const eagerMethods = useMemo(() => {
    const eagerMethods: Record<string, any> = {};
    for (const key of EAGER_METHODS) {
      const method = result[key];
      eagerMethods[key] = function () {
        if (!execOptionsRef.current) {
          execOptionsRef.current = Object.create(null);
          // Only the first time populating execOptionsRef.current matters here.
          internalState.forceUpdate();
        }
        return method.apply(this, arguments);
      };
    }

    return eagerMethods;
  }, []);

  Object.assign(result, eagerMethods);

  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => {
        controller.abort();
      });
    }
  }, [])

  const execute = useCallback<
    LazyQueryResultTuple<TData, TVariables>[0]
  >(executeOptions => {
    const controller = new AbortController();
    abortControllersRef.current.add(controller);

    execOptionsRef.current = executeOptions ? {
      ...executeOptions,
      fetchPolicy: executeOptions.fetchPolicy || initialFetchPolicy,
    } : {
      fetchPolicy: initialFetchPolicy,
    };

    const promise = internalState
      .asyncUpdate(controller.signal) // Like internalState.forceUpdate, but returns a Promise.
      .then(queryResult => {
        abortControllersRef.current.delete(controller);

        return Object.assign(queryResult, eagerMethods);
      });

    promise.catch(() => {
      abortControllersRef.current.delete(controller);
    });

    return promise;
  }, []);

  return [execute, result];
}
