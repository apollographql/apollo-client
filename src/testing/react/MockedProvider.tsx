import * as React from "react";

import type { DefaultOptions } from "../../core/index.js";
import { ApolloClient } from "../../core/index.js";
import { InMemoryCache as Cache } from "../../cache/index.js";
import { ApolloProvider } from "../../react/context/index.js";
import type { MockedResponse } from "../core/index.js";
import { MockLink } from "../core/index.js";
import type { ApolloLink } from "../../link/core/index.js";
import type { Resolvers } from "../../core/index.js";
import type { ApolloCache } from "../../cache/index.js";
import type { DevtoolsOptions } from "../../core/ApolloClient.js";
import { invariant } from "../../utilities/globals/index.js";

export interface MockedProviderProps<TSerializedCache = {}> {
  mocks?: ReadonlyArray<MockedResponse<any, any>>;
  addTypename?: boolean;
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
   *
   * @deprecated `connectToDevTools` will be removed in Apollo Client 4.0.
   *
   * **Recommended now**
   *
   * Use the `devtools.enabled` option instead.
   *
   * ```ts
   * <MockedProvider devtools={{ enabled: true }} />
   * ```
   */
  connectToDevTools?: boolean;

  /**
   * Configuration used by the [Apollo Client Devtools extension](https://www.apollographql.com/docs/react/development-testing/developer-tooling/#apollo-client-devtools) for this client.
   *
   * @since 3.14.0
   */
  devtools?: DevtoolsOptions;
}

export interface MockedProviderState {
  client: ApolloClient<any>;
}

export class MockedProvider extends React.Component<
  MockedProviderProps,
  MockedProviderState
> {
  public static defaultProps: MockedProviderProps = {
    addTypename: true,
  };

  constructor(props: MockedProviderProps) {
    super(props);

    const {
      mocks,
      addTypename,
      defaultOptions,
      cache,
      resolvers,
      link,
      showWarnings,
      connectToDevTools = false,
    } = this.props;
    if (__DEV__) {
      if ("connectToDevTools" in this.props) {
        invariant.warn(
          "`connectToDevTools` is deprecated and will be removed in Apollo Client 4.0. Please use `devtools.enabled` instead."
        );
      }
    }

    const client = new ApolloClient({
      cache: cache || new Cache({ addTypename }),
      defaultOptions,
      devtools: {
        enabled: connectToDevTools,
      },
      link: link || new MockLink(mocks || [], addTypename, { showWarnings }),
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
