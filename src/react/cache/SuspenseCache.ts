import { ApolloClient } from '../../core';
import { SuspenseQueryCache } from './SuspenseQueryCache';
import { wrap } from 'optimism';

export class SuspenseCache {
  forClient = wrap((client: ApolloClient<unknown>) => {
    return new SuspenseQueryCache(client);
  });
}
