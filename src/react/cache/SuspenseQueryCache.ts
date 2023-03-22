import { Trie } from '@wry/trie';
import {
  ApolloClient,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { QuerySubscription } from './QuerySubscription';
import { wrap } from 'optimism';

import { canonicalStringify } from '../../cache';
import { canUseWeakMap } from '../../utilities';

export type CacheKey = [DocumentNode, string];

const EMPTY_VARIABLES = Object.create(null);

export class SuspenseQueryCache {
  private client: ApolloClient<unknown>;

  private cacheKeys = new Trie<CacheKey>(
    false,
    (cacheKey: CacheKey) => cacheKey
  );

  // private subscriptions = new Map<CacheKey, QuerySubscription>();

  constructor(client: ApolloClient<unknown>) {
    this.client = client;
  }

  getSubscription = wrap(
    <TData = any>(
      query: DocumentNode | TypedDocumentNode<TData>,
      variables: OperationVariables | undefined,
      createObservable: (
        client: ApolloClient<unknown>
      ) => ObservableQuery<TData>
    ) => {
      console.log('create subscription', variables);
      return new QuerySubscription(createObservable(this.client), {
        // onDispose: () => {
        //   console.log('on dispose');
        //   this.getSubscription.forget(query, variables);
        // },
      });
    },
    {
      makeCacheKey: (query, variables) => {
        return this.cacheKeys.lookup(
          query,
          canonicalStringify(variables || EMPTY_VARIABLES)
        );
      },
    }
  );
}
