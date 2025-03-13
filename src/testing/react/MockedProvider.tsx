import * as React from "react";

import type { ApolloCache } from "@apollo/client/cache";
import { InMemoryCache as Cache } from "@apollo/client/cache";
import type { DefaultOptions } from "@apollo/client/core";
import type { Resolvers } from "@apollo/client/core";
import { ApolloClient } from "@apollo/client/core";
import type { ApolloLink } from "@apollo/client/link/core";
import { ApolloProvider } from "@apollo/client/react";
import type { MockedResponse } from "@apollo/client/testing/core";
import { MockLink } from "@apollo/client/testing/core";

export interface MockedProviderProps<TSerializedCache = {}> {
  mocks?: ReadonlyArray<MockedResponse<any, any>>;
  defaultOptions?: DefaultOptions;
  cache?: ApolloCache<TSerializedCache>;
  resolvers?: Resolvers;
  childProps?: object;
  children?: any;
  link?: ApolloLink;
  showWarnings?: boolean;
  /**
   * If set to true, the MockedProvider will try to connect to the Apollo DevTools.
   * Defaults to false.
   */
  connectToDevTools?: boolean;
}

interface MockedProviderState {
  client: ApolloClient<any>;
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
      resolvers,
      link,
      showWarnings,
      connectToDevTools = false,
    } = this.props;
    const client = new ApolloClient({
      cache: cache || new Cache(),
      defaultOptions,
      connectToDevTools,
      link: link || new MockLink(mocks || [], { showWarnings }),
      resolvers,
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
