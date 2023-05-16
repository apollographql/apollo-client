import { invariant } from '../../utilities/globals';

import * as React from 'react';

import type { ApolloClient } from '../../core';
import { getApolloContext } from './ApolloContext';
import type { SuspenseCache } from '../cache';

export interface ApolloProviderProps<TCache> {
  client: ApolloClient<TCache>;
  suspenseCache?: SuspenseCache;
  children: React.ReactNode | React.ReactNode[] | null;
}

export const ApolloProvider: React.FC<ApolloProviderProps<any>> = ({
  client,
  suspenseCache,
  children
}) => {
  const ApolloContext = getApolloContext();
  const parentContext = React.useContext(ApolloContext);

  const newContext = React.useMemo(() => {
    let context = parentContext;
    if (client && parentContext.client !== client) {
      context = Object.assign({}, context, { client });
    }
    if (suspenseCache && parentContext.suspenseCache !== suspenseCache) {
      context = Object.assign({}, context, { suspenseCache });
    }
    return context;
  }, [parentContext, client, suspenseCache]);

  invariant(
    newContext.client,
    'ApolloProvider was not passed a client instance. Make ' +
      'sure you pass in your client via the "client" prop.'
  );

  return (
    <ApolloContext.Provider value={newContext}>
      {children}
    </ApolloContext.Provider>
  );
};
