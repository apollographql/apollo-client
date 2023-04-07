import * as React from 'react';

import { ApolloClient, DefaultOptions } from '../../core';
import { InMemoryCache as Cache } from '../../cache';
import { ApolloProvider } from '../../react/context';
import { SuspenseCache } from '../../react';
import { MockLink, MockedResponse } from '../core';
import { ApolloLink } from '../../link/core';
import { Resolvers } from '../../core';
import { ApolloCache } from '../../cache';

export interface MockedProviderProps<TSerializedCache = {}> {
  mocks?: ReadonlyArray<MockedResponse>;
  addTypename?: boolean;
  defaultOptions?: DefaultOptions;
  cache?: ApolloCache<TSerializedCache>;
  resolvers?: Resolvers;
  childProps?: object;
  children?: any;
  link?: ApolloLink;
  suspenseCache?: SuspenseCache;
  showWarnings?: boolean;
}

export interface MockedProviderState {
  client: ApolloClient<any>;
  suspenseCache: SuspenseCache;
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
      suspenseCache,
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

    this.state = {
      client,
      suspenseCache: suspenseCache || new SuspenseCache()
    };
  }

  public render() {
    const { children, childProps } = this.props;
    const { client, suspenseCache } = this.state;

    return React.isValidElement(children) ? (
      <ApolloProvider client={client} suspenseCache={suspenseCache}>
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
