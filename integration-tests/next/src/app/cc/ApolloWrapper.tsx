'use client';
import React from 'react';
import { HttpLink, SuspenseCache } from '@apollo/client';
import {
  ApolloNextAppProvider,
  NextSSRInMemoryCache,
  NextSSRApolloClient,
} from '@apollo/experimental-nextjs-app-support/ssr';

import { loadErrorMessages, loadDevMessages } from '@apollo/client/dev';
import { setVerbosity } from 'ts-invariant';
import { schemaLink } from '@/libs/schemaLink';

//if (process.env.NODE_ENV === 'development') {
setVerbosity('debug');
loadDevMessages();
loadErrorMessages();
//}

export function ApolloWrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <ApolloNextAppProvider
      makeClient={makeClient}
      makeSuspenseCache={makeSuspenseCache}
    >
      {children}
    </ApolloNextAppProvider>
  );

  function makeClient() {
    const httpLink = new HttpLink({
      uri: 'https://main--hack-the-e-commerce.apollographos.net/graphql',
    });

    return new NextSSRApolloClient({
      cache: new NextSSRInMemoryCache(),
      link: typeof window === "undefined" ? schemaLink : httpLink,
    });
  }

  function makeSuspenseCache() {
    return new SuspenseCache();
  }
}
