import React, { useContext } from 'react';
import { render, cleanup } from '@testing-library/react';

import { ApolloLink } from '../../../link/core/ApolloLink';
import { ApolloClient } from '../../../ApolloClient';
import { InMemoryCache as Cache } from '../../../cache/inmemory/inMemoryCache';
import { ApolloProvider } from '../ApolloProvider';
import { getApolloContext } from '../ApolloContext';

describe('<ApolloProvider /> Component', () => {
  afterEach(cleanup);

  const client = new ApolloClient({
    cache: new Cache(),
    link: new ApolloLink((o, f) => (f ? f(o) : null))
  });

  class Child extends React.Component<any, { store: any; client: any }> {
    static contextType = getApolloContext();

    componentDidUpdate() {
      if (this.props.data) this.props.data.refetch();
    }

    render() {
      return null;
    }
  }

  interface Props {
    client: ApolloClient<any>;
  }

  class Container extends React.Component<Props, any> {
    constructor(props: Props) {
      super(props);
      this.state = {};
    }

    componentDidMount() {
      this.setState({
        client: this.props.client
      });
    }

    render() {
      return (
        <ApolloProvider client={this.state.client || this.props.client}>
          <Child />
        </ApolloProvider>
      );
    }
  }

  it('should render children components', () => {
    const { getByText } = render(
      <ApolloProvider client={client}>
        <div className="unique">Test</div>
      </ApolloProvider>
    );

    expect(getByText('Test')).toBeTruthy();
  });

  it('should support the 2.0', () => {
    const { getByText } = render(
      <ApolloProvider client={{} as ApolloClient<any>}>
        <div className="unique">Test</div>
      </ApolloProvider>
    );

    expect(getByText('Test')).toBeTruthy();
  });

  it('should require a client', () => {
    const originalConsoleError = console.error;
    console.error = () => {
      /* noop */
    };
    expect(() => {
      // Before testing `ApolloProvider`, we first fully reset the
      // existing context using `ApolloContext.Provider` directly.
      const ApolloContext = getApolloContext();
      render(
        <ApolloContext.Provider value={{}}>
          <ApolloProvider client={undefined as any}>
            <div className="unique" />
          </ApolloProvider>
        </ApolloContext.Provider>
      );
    }).toThrowError(
      'ApolloProvider was not passed a client instance. Make ' +
        'sure you pass in your client via the "client" prop.'
    );
    console.error = originalConsoleError;
  });

  it('should not require a store', () => {
    const { getByText } = render(
      <ApolloProvider client={client}>
        <div className="unique">Test</div>
      </ApolloProvider>
    );
    expect(getByText('Test')).toBeTruthy();
  });

  it('should add the client to the children context', () => {
    const TestChild = () => {
      const context = useContext(getApolloContext());
      expect(context.client).toEqual(client);
      return null;
    };
    render(
      <ApolloProvider client={client}>
        <TestChild />
        <TestChild />
      </ApolloProvider>
    );
  });

  it('should update props when the client changes', () => {
    let clientToCheck = client;

    const TestChild = () => {
      const context = useContext(getApolloContext());
      expect(context.client).toEqual(clientToCheck);
      return null;
    };
    const { rerender } = render(
      <ApolloProvider client={clientToCheck}>
        <TestChild />
      </ApolloProvider>
    );

    const newClient = new ApolloClient({
      cache: new Cache(),
      link: new ApolloLink((o, f) => (f ? f(o) : null))
    });
    clientToCheck = newClient;
    rerender(
      <ApolloProvider client={clientToCheck}>
        <TestChild />
      </ApolloProvider>
    );
  });
});
