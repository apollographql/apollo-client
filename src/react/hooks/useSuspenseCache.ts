import { useContext } from 'react';
import { getApolloContext } from '../context';
import { invariant } from '../../utilities/globals';
import type { SuspenseCache } from '../cache';

export function useSuspenseCache(override?: SuspenseCache) {
  const context = useContext(getApolloContext());
  const suspenseCache = override || context.suspenseCache;

  invariant(
    suspenseCache,
    'Could not find a "suspenseCache" in the context or passed in as an option. ' +
      'Wrap the root component in an <ApolloProvider> and provide a suspenseCache, ' +
      'or pass a SuspenseCache instance in via options.'
  );

  return suspenseCache;
}
