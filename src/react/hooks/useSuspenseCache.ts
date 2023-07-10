import type { SuspenseCacheOptions } from '../cache/index.js';
import { SuspenseCache } from '../cache/index.js';
import type { ApolloClient } from '../../core/ApolloClient.js';

declare module '../../core/ApolloClient.js' {
  interface ApolloClientOptions<TCacheShape> {
    react?: {
      suspenseCacheOptions?: SuspenseCacheOptions;
    };
  }
}

const suspenseCacheSymbol = Symbol.for('apollo.suspenseCache');

export function useSuspenseCache(client: ApolloClient<object>) {
  const clientWithSuspenseCache: ApolloClient<object> & {
    [suspenseCacheSymbol]?: SuspenseCache;
  } = client;

  if (!clientWithSuspenseCache[suspenseCacheSymbol]) {
    clientWithSuspenseCache[suspenseCacheSymbol] = new SuspenseCache(
      clientWithSuspenseCache['excessOptions'].react?.suspenseCacheOptions
    );
  }

  return clientWithSuspenseCache[suspenseCacheSymbol];
}
