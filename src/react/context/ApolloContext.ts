import * as React from 'react';
import type { ApolloClient } from '../../core';
import { canUseSymbol } from '../../utilities';
import type { SuspenseCache } from '../cache';
import type { RenderPromises } from '../ssr';
import { global, invariant } from '../../utilities/globals';

export interface ApolloContextValue {
  client?: ApolloClient<object>;
  renderPromises?: RenderPromises;
  suspenseCache?: SuspenseCache;
}

type ReactVersion = string;
declare global {
  interface Window {
    [contextKey]: Record<ReactVersion, React.Context<ApolloContextValue>>;
  }
}

// To make sure that Apollo Client does not create more than one React context
// per React version, we store that Context in a global Map, keyed by the
// React version. This way, if there are multiple versions of React loaded,
// (e.g. in a Microfrontend environment), each React version will get its own
// Apollo context.
// If there are multiple versions of Apollo Client though, which can happen by
// accident, this can avoid bugs where those multiple Apollo Client versions
// would be unable to "see each other", even if an ApolloProvider was present.
const contextKey: unique symbol = canUseSymbol
  ? Symbol.for('__APOLLO_CONTEXT__')
  : ('__APOLLO_CONTEXT__' as any);

export function getApolloContext(): React.Context<ApolloContextValue> {
  invariant(
    'createContext' in React,
    'Invoking `getApolloContext` in an environment where `React.createContext` is not available.\n' +
      'The Apollo Client functionality you are trying to use is only available in React Client Components.\n' +
      'Please make sure to add "use client" at the top of your file.\n' +
      // TODO: change to React documentation once React documentation contains information about Client Components
      'For more information, see https://nextjs.org/docs/getting-started/react-essentials#client-components'
  );

  let contextStorage = global[contextKey] || (
    global[contextKey] = Object.create(null)
  );

  return contextStorage[React.version] || (
    contextStorage[React.version] = Object.assign(
      React.createContext<ApolloContextValue>({}),
      { displayName: 'ApolloContext' },
    )
  );
}

/**
 * @deprecated This function has no "resetting" effect since Apollo Client 3.4.12,
 * and will be removed in the next major version of Apollo Client.
 * If you want to get the Apollo Context, use `getApolloContext` instead.
 */
export const resetApolloContext = getApolloContext;
