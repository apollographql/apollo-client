import type { MatcherFunction } from 'expect';
import type { DocumentNode } from 'graphql';
import type { ApolloClient, OperationVariables } from '../../core';
import { SuspenseCache } from '../../react';
import { canonicalStringify } from '../../cache';

export const toHaveSuspenseCacheEntryUsing: MatcherFunction<
  [
    client: ApolloClient<unknown>,
    query: DocumentNode,
    options: {
      variables?: OperationVariables;
      queryKey?: string | number | any[];
    }
  ]
> = function (
  suspenseCache,
  client,
  query,
  { variables, queryKey = [] } = Object.create(null)
) {
  if (!(suspenseCache instanceof SuspenseCache)) {
    throw new Error('Actual must be an instance of `SuspenseCache`');
  }

  const cacheKey = (
    [client, query, canonicalStringify(variables)] as any[]
  ).concat(queryKey);
  const queryRef = suspenseCache['queryRefs'].lookupArray(cacheKey)?.current;

  return {
    pass: !!queryRef,
    message: () => {
      return `Expected suspense cache ${
        queryRef ? 'not ' : ''
      }to have cache entry using key`;
    },
  };
};
