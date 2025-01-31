import * as React from "react";
import type { ApolloClient } from "../../core/index.js";
import { ApolloProvider } from "../../react/index.js";
import type { MockedProviderProps } from "../react/MockedProvider.js";
import { MockedProvider } from "../react/MockedProvider.js";

export function createClientWrapper(
  client: ApolloClient<any>,
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
  renderOptions: MockedProviderProps<any>,
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
