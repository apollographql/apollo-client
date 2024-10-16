import * as React from "react";
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import type { Queries, RenderOptions, queries } from "@testing-library/react";
import type { ApolloClient } from "../../core/index.js";
import { ApolloProvider } from "../../react/index.js";
import type { MockedProviderProps } from "../react/MockedProvider.js";
import { MockedProvider } from "../react/MockedProvider.js";

export interface RenderWithClientOptions<
  Q extends Queries = typeof queries,
  Container extends Element | DocumentFragment = HTMLElement,
  BaseElement extends Element | DocumentFragment = Container,
> extends RenderOptions<Q, Container, BaseElement> {
  client: ApolloClient<any>;
}

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

export function renderWithClient<
  Q extends Queries = typeof queries,
  Container extends Element | DocumentFragment = HTMLElement,
  BaseElement extends Element | DocumentFragment = Container,
>(
  ui: ReactElement,
  {
    client,
    wrapper,
    ...renderOptions
  }: RenderWithClientOptions<Q, Container, BaseElement>
) {
  return render(ui, {
    ...renderOptions,
    wrapper: createClientWrapper(client, wrapper),
  });
}

export interface RenderWithMocksOptions<
  Q extends Queries = typeof queries,
  Container extends Element | DocumentFragment = HTMLElement,
  BaseElement extends Element | DocumentFragment = Container,
> extends RenderOptions<Q, Container, BaseElement>,
    MockedProviderProps<any> {}

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

export function renderWithMocks<
  Q extends Queries = typeof queries,
  Container extends Element | DocumentFragment = HTMLElement,
  BaseElement extends Element | DocumentFragment = Container,
>(
  ui: ReactElement,
  {
    wrapper,
    ...renderOptions
  }: RenderWithMocksOptions<Q, Container, BaseElement>
) {
  return render(ui, {
    ...renderOptions,
    wrapper: createMockWrapper(renderOptions, wrapper),
  });
}
