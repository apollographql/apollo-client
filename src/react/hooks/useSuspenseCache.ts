import * as React from 'react';
import { getApolloContext } from '../context/index.js';
import { invariant } from '../../utilities/globals/index.js';
import type { SuspenseCache } from '../cache/index.js';

export function useSuspenseCache(override?: SuspenseCache) {
  const context = React.useContext(getApolloContext());
  const suspenseCache = override || context.suspenseCache;

  invariant(
    suspenseCache,
    'Could not find a "suspenseCache" in the context or passed in as an option. ' +
      'Wrap the root component in an <ApolloProvider> and provide a suspenseCache, ' +
      'or pass a SuspenseCache instance in via options.'
  );

  return suspenseCache;
}
