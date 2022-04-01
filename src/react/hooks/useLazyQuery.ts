import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useCallback, useMemo, useRef } from 'react';

import { OperationVariables } from '../../core';
import { ApolloError } from '../../errors';
import {
  LazyQueryHookOptions,
  LazyQueryResultTuple,
  QueryResult,
} from '../types/types';
import { useInternalState } from './useQuery';
import { useApolloClient } from './useApolloClient';
import { isNonEmptyArray } from '../../utilities';

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

export function useLazyQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: LazyQueryHookOptions<TData, TVariables>
): LazyQueryResultTuple<TData, TVariables> {
  const internalState = useInternalState(
    useApolloClient(options && options.client),
    query,
  );

  const execOptionsRef = useRef<Partial<LazyQueryHookOptions<TData, TVariables>>>();
  const defaultOptions = internalState.client.defaultOptions.watchQuery;
  const initialFetchPolicy =
    (options && options.fetchPolicy) ||
    (execOptionsRef.current && execOptionsRef.current.fetchPolicy) ||
    (defaultOptions && defaultOptions.fetchPolicy) ||
    "cache-first";

  const useQueryResult = internalState.useQuery({
    ...options,
    ...execOptionsRef.current,
    // TODO This probably means this.observable.initialFetchPolicy is never set
    // appropriately.
    skip: !execOptionsRef.current,
  });

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
    const promise = result.reobserve(
      execOptionsRef.current = executeOptions ? {
        ...executeOptions,
        fetchPolicy: executeOptions.fetchPolicy || initialFetchPolicy,
      } : {
        fetchPolicy: initialFetchPolicy,
      },
    ).then(apolloQueryResult => {
      // If this.observable.options.fetchPolicy is "standby", the
      // apolloQueryResult we receive here can be undefined, so we call
      // getCurrentResult to obtain a stub result. TODO Investigate whether
      // standby queries could return this stub result in the first place.
      apolloQueryResult = apolloQueryResult || internalState["getCurrentResult"]();

      if (
        apolloQueryResult.error ||
        isNonEmptyArray(apolloQueryResult.errors)
      ) {
        const {
          errorPolicy = "none",
        } = result.observable.options;

        if (errorPolicy === "none") {
          throw apolloQueryResult.error || new ApolloError({
            graphQLErrors: apolloQueryResult.errors,
          });
        }
      }

      return internalState.toQueryResult(apolloQueryResult);

    }).then(queryResult => Object.assign(queryResult, eagerMethods));

    // Deliver the loading state for this reobservation immediately.
    internalState.forceUpdate();

    // Because the return value of `useLazyQuery` is usually floated, we need
    // to catch the promise to prevent unhandled rejections.
    promise.catch(() => {});

    return promise;
  }, []);

  return [execute, result];
}
