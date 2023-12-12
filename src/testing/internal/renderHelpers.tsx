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

export function renderWithClient<
  Q extends Queries = typeof queries,
  Container extends Element | DocumentFragment = HTMLElement,
  BaseElement extends Element | DocumentFragment = Container,
>(
  ui: ReactElement,
  {
    client,
    wrapper: Wrapper = React.Fragment,
    ...renderOptions
  }: RenderWithClientOptions<Q, Container, BaseElement>
) {
  return render(ui, {
    ...renderOptions,
    wrapper: ({ children }) => {
      return (
        <ApolloProvider client={client}>
          <Wrapper>{children}</Wrapper>
        </ApolloProvider>
      );
    },
  });
}

export interface RenderWithMocksOptions<
  Q extends Queries = typeof queries,
  Container extends Element | DocumentFragment = HTMLElement,
  BaseElement extends Element | DocumentFragment = Container,
> extends RenderOptions<Q, Container, BaseElement>,
    MockedProviderProps<any> {}

export function renderWithMocks<
  Q extends Queries = typeof queries,
  Container extends Element | DocumentFragment = HTMLElement,
  BaseElement extends Element | DocumentFragment = Container,
>(
  ui: ReactElement,
  {
    wrapper: Wrapper = React.Fragment,
    ...renderOptions
  }: RenderWithMocksOptions<Q, Container, BaseElement>
) {
  return render(ui, {
    ...renderOptions,
    wrapper: ({ children }) => {
      return (
        <MockedProvider {...renderOptions}>
          <Wrapper>{children}</Wrapper>
        </MockedProvider>
      );
    },
  });
}
