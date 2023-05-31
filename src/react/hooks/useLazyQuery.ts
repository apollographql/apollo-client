import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useCallback, useMemo, useRef } from 'react';

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
  const execOptionsRef = useRef<Partial<LazyQueryHookOptions<TData, TVariables>>>();
  const optionsRef = useRef<LazyQueryHookOptions<TData, TVariables>>();
  const queryRef = useRef<DocumentNode | TypedDocumentNode<TData, TVariables>>();
  const merged = execOptionsRef.current ? mergeOptions(options, execOptionsRef.current) : options;
  const document = merged?.query ?? query;

  // Use refs to track options and the used query to ensure the `execute` 
  // function remains referentially stable between renders.
  optionsRef.current = merged;
  queryRef.current = document;

  const internalState = useInternalState<TData, TVariables>(
    useApolloClient(options && options.client),
    document
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

  const execute = useCallback<
    LazyQueryResultTuple<TData, TVariables>[0]
  >(executeOptions => {
    execOptionsRef.current = executeOptions ? {
      ...executeOptions,
      fetchPolicy: executeOptions.fetchPolicy || initialFetchPolicy,
    } : {
      fetchPolicy: initialFetchPolicy,
    };

    const options = mergeOptions(optionsRef.current, {
      query: queryRef.current,
      ...execOptionsRef.current,
    })

    const promise = internalState
      .executeQuery({ ...options, skip: false }) 
      .then((queryResult) => Object.assign(queryResult, eagerMethods));

    // Because the return value of `useLazyQuery` is usually floated, we need
    // to catch the promise to prevent unhandled rejections.
    promise.catch(() => {});

    return promise;
  }, []);

  return [execute, result];
}
