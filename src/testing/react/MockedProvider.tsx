import * as React from 'react';

import { ApolloClient, DefaultOptions } from '../../core/index.js';
import { InMemoryCache as Cache } from '../../cache/index.js';
import { ApolloProvider } from '../../react/context/index.js';
import { MockLink, MockedResponse } from '../core/index.js';
import { ApolloLink } from '../../link/core/index.js';
import { Resolvers } from '../../core/index.js';
import { ApolloCache } from '../../cache/index.js';

export interface MockedProviderProps<TSerializedCache = {}> {
  mocks?: ReadonlyArray<MockedResponse>;
  addTypename?: boolean;
  defaultOptions?: DefaultOptions;
  cache?: ApolloCache<TSerializedCache>;
  resolvers?: Resolvers;
  childProps?: object;
  children?: any;
  link?: ApolloLink;
  showWarnings?: boolean;
}

export interface MockedProviderState {
  client: ApolloClient<any>;
}

export class MockedProvider extends React.Component<
  MockedProviderProps,
  MockedProviderState
> {
  public static defaultProps: MockedProviderProps = {
    addTypename: true
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
    } = this.props;
    const client = new ApolloClient({
      cache: cache || new Cache({ addTypename }),
      defaultOptions,
      link: link || new MockLink(
        mocks || [],
        addTypename,
        { showWarnings }
      ),
      resolvers,
    });

    this.state = { client };
  }

  public render() {
    const { children, childProps } = this.props;
    return React.isValidElement(children) ? (
      <ApolloProvider client={this.state.client}>
        {React.cloneElement(React.Children.only(children), { ...childProps })}
      </ApolloProvider>
    ) : null;
  }

  public componentWillUnmount() {
    // Since this.state.client was created in the constructor, it's this
    // MockedProvider's responsibility to terminate it.
    this.state.client.stop();
  }
}
