import * as React from "react";

import type { ApolloClient } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import type { MockedProviderProps } from "@apollo/client/testing/react";
import { MockedProvider } from "@apollo/client/testing/react";

export function createClientWrapper(
  client: ApolloClient,
  Wrapper: React.JSXElementConstructor<{
    children: React.ReactNode;
  }> = React.Fragment
): React.JSXElementConstructor<{
  children: React.ReactNode;
}> {
  return ({ children }) => {
    return (
      <ApolloProvider client={client}>
        <Wrapper>{children}</Wrapper>
      </ApolloProvider>
    );
  };
}

export function createMockWrapper(
  renderOptions: MockedProviderProps,
  Wrapper: React.JSXElementConstructor<{
    children: React.ReactNode;
  }> = React.Fragment
): React.JSXElementConstructor<{
  children: React.ReactNode;
}> {
  return ({ children }) => {
    return (
      <MockedProvider {...renderOptions}>
        <Wrapper>{children}</Wrapper>
      </MockedProvider>
    );
  };
}
