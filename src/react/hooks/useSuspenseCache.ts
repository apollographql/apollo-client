import { useContext } from 'react';
import { getApolloContext } from '../context';
import { invariant } from '../../utilities/globals';
import { SuspenseCache } from '../cache';

export function useSuspenseCache(override?: SuspenseCache) {
  const apolloContext = getApolloContext()
  if (!apolloContext) {
    invariant(override, 
      'Called `useSuspenseCache` in an environment where Context is not ' + 
      'available without passing an override in.')
    return override;
  }
  const context = useContext(apolloContext);
  const suspenseCache = override || context.suspenseCache;

  invariant(
    suspenseCache,
    'Could not find a "suspenseCache" in the context or passed in as an option. ' +
      'Wrap the root component in an <ApolloProvider> and provide a suspenseCache, ' +
      'or pass a SuspenseCache instance in via options.'
  );

  return suspenseCache;
}
