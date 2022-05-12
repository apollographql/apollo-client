import * as React from 'react';
import { ApolloClient } from '../../core';
import { canUseSymbol } from '../../utilities';
import type { RenderPromises } from '../ssr';

export interface ApolloContextValue {
  client?: ApolloClient<object>;
  renderPromises?: RenderPromises;
}

// To make sure Apollo Client doesn't create more than one React context
// (which can lead to problems like having an Apollo Client instance added
// in one context, then attempting to retrieve it from another different
// context), a single Apollo context is created and tracked in global state.
const contextKey = canUseSymbol
  ? Symbol.for('__APOLLO_CONTEXT__')
  : '__APOLLO_CONTEXT__';

export function getApolloContext(): React.Context<ApolloContextValue> {
  let context = (React.createContext as any)[contextKey] as React.Context<ApolloContextValue>;
  if (!context) {
    Object.defineProperty(React.createContext, contextKey, {
      value: context = React.createContext<ApolloContextValue>({}),
      enumerable: false,
      writable: false,
      configurable: true,
    });
    context.displayName = 'ApolloContext';
  }
  return context;
}

export { getApolloContext as resetApolloContext }
