import * as React from "react";

import type { DefaultOptions } from "@apollo/client";
import { ApolloClient } from "@apollo/client";
import type { ApolloCache } from "@apollo/client/cache";
import { InMemoryCache as Cache } from "@apollo/client/cache";
import type { ApolloLink } from "@apollo/client/link";
import type { LocalState } from "@apollo/client/local-state";
import { ApolloProvider } from "@apollo/client/react";
import type { MockedResponse } from "@apollo/client/testing";
import { MockLink } from "@apollo/client/testing";

export interface MockedProviderProps {
  mocks?: ReadonlyArray<MockedResponse<any, any>>;
  defaultOptions?: DefaultOptions;
  cache?: ApolloCache;
  localState?: LocalState;
  childProps?: object;
  children?: any;
  link?: ApolloLink;
  showWarnings?: boolean;
  mockLinkDefaultOptions?: MockLink.DefaultOptions;
  /**
   * If set to true, the MockedProvider will try to connect to the Apollo DevTools.
   * Defaults to false.
   */
  connectToDevTools?: boolean;
}

interface MockedProviderState {
  client: ApolloClient;
}

export class MockedProvider extends React.Component<
  MockedProviderProps,
  MockedProviderState
> {
  constructor(props: MockedProviderProps) {
    super(props);

    const {
      mocks,
      defaultOptions,
      cache,
      localState,
      link,
      showWarnings,
      mockLinkDefaultOptions,
      connectToDevTools = false,
    } = this.props;
    const client = new ApolloClient({
      cache: cache || new Cache(),
      defaultOptions,
      connectToDevTools,
      link:
        link ||
        new MockLink(mocks || [], {
          showWarnings,
          defaultOptions: mockLinkDefaultOptions,
        }),
      localState,
    });

    this.state = {
      client,
    };
  }

  public render() {
    const { children, childProps } = this.props;
    const { client } = this.state;

    return React.isValidElement(children) ?
        <ApolloProvider client={client}>
          {React.cloneElement(React.Children.only(children), { ...childProps })}
        </ApolloProvider>
      : null;
  }

  public componentWillUnmount() {
    // Since this.state.client was created in the constructor, it's this
    // MockedProvider's responsibility to terminate it.
    this.state.client.stop();
  }
}
