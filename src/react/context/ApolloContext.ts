import React from 'react';

import ApolloClient from '../../ApolloClient';

export interface ApolloContextValue {
  client?: ApolloClient<object>;
  renderPromises?: Record<any, any>;
}

let apolloContext: React.Context<ApolloContextValue>;

export function getApolloContext() {
  if (!apolloContext) {
    apolloContext = React.createContext<ApolloContextValue>({});
  }
  return apolloContext;
}

export function resetApolloContext() {
  apolloContext = React.createContext<ApolloContextValue>({});
}
