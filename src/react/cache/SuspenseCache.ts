import { ApolloClient } from '../../core';
import { SuspenseQueryCache } from './SuspenseQueryCache';

export class SuspenseCache {
  private queryCaches = new Map<ApolloClient<unknown>, SuspenseQueryCache>();

  forClient(client: ApolloClient<unknown>) {
    if (!this.queryCaches.has(client)) {
      this.queryCaches.set(client, new SuspenseQueryCache(client));
    }

    return this.queryCaches.get(client)!;
  }
}
