import { ApolloClient } from '../../core';
import { SuspenseQueryCache } from './SuspenseQueryCache';
import { wrap } from 'optimism';

export class SuspenseCache {
  forClient = wrap((client: ApolloClient<unknown>) => {
    console.log('new client cache');
    return new SuspenseQueryCache(client);
  });
}
