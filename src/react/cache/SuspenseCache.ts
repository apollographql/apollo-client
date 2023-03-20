import { ApolloClient } from '../../core';
import { SuspenseQueryCache } from './SuspenseQueryCache';

export class SuspenseCache {
  private caches = new Map<ApolloClient<unknown>, SuspenseQueryCache>();

  forClient(client: ApolloClient<unknown>) {
    if (!this.caches.has(client)) {
      this.caches.set(client, new SuspenseQueryCache());
    }

    return this.caches.get(client)!;
  }
}
