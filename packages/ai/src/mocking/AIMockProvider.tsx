import * as React from "react";

import { ApolloClient } from "@apollo/client";
import type { ApolloCache } from "@apollo/client/cache";
import { InMemoryCache as Cache } from "@apollo/client/cache";
import type { ApolloLink } from "@apollo/client/link";
import type { LocalState } from "@apollo/client/local-state";
import { ApolloProvider } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import { AIAdapter } from "./AIAdapter.js";
import { AIMockLink } from "./AIMockLink.js";

export interface AIMockedProviderProps {
  adapter: AIAdapter;
  systemPrompt?: string;
  schema?: string;
  defaultOptions?: ApolloClient.DefaultOptions;
  cache?: ApolloCache;
  localState?: LocalState;
  childProps?: object;
  children?: any;
  link?: ApolloLink;
  showWarnings?: boolean;
  mockLinkDefaultOptions?: MockLink.DefaultOptions;
  devtools?: ApolloClient.Options["devtools"];
}

interface AIMockedProviderState {
  client: ApolloClient;
}

export class AIMockedProvider extends React.Component<
  AIMockedProviderProps,
  AIMockedProviderState
> {
  constructor(props: AIMockedProviderProps) {
    super(props);

    const {
      adapter,
      schema,
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
        new AIMockLink({
          adapter,
          schema,
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
    // Since this.state.client was created in the
    // constructor, it's this MockedProvider's responsibility
    // to terminate it.
    this.state.client.stop();
  }
}
