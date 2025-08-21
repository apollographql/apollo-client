import * as React from "react";

import { ApolloClient } from "@apollo/client";
import type { ApolloCache } from "@apollo/client/cache";
import { InMemoryCache as Cache } from "@apollo/client/cache";
import type { ApolloLink } from "@apollo/client/link";
import type { LocalState } from "@apollo/client/local-state";
import { ApolloProvider } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";

export interface MockedProviderProps {
  mocks?: ReadonlyArray<MockLink.MockedResponse<any, any>>;
  defaultOptions?: ApolloClient.DefaultOptions;
  cache?: ApolloCache;
  localState?: LocalState;
  childProps?: object;
  children?: any;
  link?: ApolloLink;
  showWarnings?: boolean;
  mockLinkDefaultOptions?: MockLink.DefaultOptions;
  /**
   * Configuration used by the [Apollo Client Devtools extension](https://www.apollographql.com/docs/react/development-testing/developer-tooling/#apollo-client-devtools) for this client.
   *
   * @since 3.14.0
   */
  devtools?: ApolloClient.Options["devtools"];
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
      devtools,
    } = this.props;
    const client = new ApolloClient({
      cache: cache || new Cache(),
      defaultOptions,
      link:
        link ||
        new MockLink(mocks || [], {
          showWarnings,
          defaultOptions: mockLinkDefaultOptions,
        }),
      localState,
      devtools,
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
