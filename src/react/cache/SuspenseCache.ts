import { ApolloClient } from '../../core';
import { SuspenseQueryCache } from './SuspenseQueryCache';
import { dep, wrap } from 'optimism';

export class SuspenseCache {
  public readonly clientDep = dep<ApolloClient<unknown>>();

  forClient = wrap((client: ApolloClient<unknown>) => {
    this.clientDep(client);

    return new SuspenseQueryCache(client);
  });
}
