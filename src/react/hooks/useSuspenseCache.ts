import { useContext } from 'react';
import { getApolloContext } from '../context';
import { invariant } from '../../utilities/globals';

export function useSuspenseCache() {
  const { suspenseCache } = useContext(getApolloContext());

  invariant(
    suspenseCache,
    'Could not find a "suspenseCache" in the context. Wrap the root component ' +
      'in an <ApolloProvider> and provide a suspenseCache.'
  );

  return suspenseCache;
}
