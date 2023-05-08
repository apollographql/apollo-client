import React, { Suspense } from 'react';
import { render, screen, renderHook, waitFor } from '@testing-library/react';
import { ErrorBoundary, ErrorBoundaryProps } from 'react-error-boundary';
import {
  gql,
  ApolloClient,
  NormalizedCacheObject,
  NetworkStatus,
  TypedDocumentNode,
  ApolloLink,
  Observable,
} from '../../../core';
import { MockedProvider, MockLink, mockSingleLink } from '../../../testing';
import {
  useBackgroundQuery_experimental as useBackgroundQuery,
  useReadQuery_experimental as useReadyQuery,
} from '../useBackgroundQuery';
import { ApolloProvider } from '../../context';
import { SuspenseCache } from '../../cache';
import { InMemoryCache } from '../../../cache';
import { QuerySubscription } from '../../cache/QuerySubscription';

// function wait(delay: number) {
//   return new Promise((resolve) => setTimeout(resolve, delay));
// }

function renderIntegrationTest({
  client,
  variables,
}: {
  client?: ApolloClient<NormalizedCacheObject>;
  variables?: Record<string, unknown>;
} = {}) {
  const query: TypedDocumentNode<QueryData> = gql`
    query SimpleQuery {
      foo {
        bar
      }
    }
  `;

  const suspenseCache = new SuspenseCache();
  const mocks = [
    {
      request: { query },
      result: { data: { foo: { bar: 'hello' } } },
    },
  ];
  const _client =
    client ||
    new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });
  interface Renders {
    errors: Error[];
    errorCount: number;
    suspenseCount: number;
    count: number;
  }
  const renders: Renders = {
    errors: [],
    errorCount: 0,
    suspenseCount: 0,
    count: 0,
  };
  const errorBoundaryProps: ErrorBoundaryProps = {
    fallback: <div>Error</div>,
    onError: (error) => {
      renders.errorCount++;
      renders.errors.push(error);
    },
  };

  interface QueryData {
    foo: { bar: string };
  }

  function SuspenseFallback() {
    renders.suspenseCount++;
    return <div>loading</div>;
  }

  function Child({
    subscription,
  }: {
    subscription: QuerySubscription<QueryData>;
  }) {
    const { data } = useReadQuery<QueryData>(subscription);
    return <div>{data.foo.bar}</div>;
  }

  function Parent() {
    const { subscription } = useBackgroundQuery(query);
    // count renders in the parent component
    renders.count++;
    return <Child subscription={subscription} />;
  }

  function ParentWithVariables({
    variables,
  }: {
    variables: Record<string, unknown>;
  }) {
    const { subscription } = useBackgroundQuery(query, { variables });
    // count renders in the parent component
    renders.count++;
    return <Child subscription={subscription} />;
  }

  function App({ variables }: { variables?: Record<string, unknown> }) {
    return (
      <ApolloProvider client={_client} suspenseCache={suspenseCache}>
        <ErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            {variables ? (
              <ParentWithVariables variables={variables} />
            ) : (
              <Parent />
            )}
          </Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const { ...rest } = render(<App variables={variables} />);
  return { ...rest, query, client: _client, renders };
}

function renderVariablesIntegrationTest({
  variables,
}: {
  variables: { id: string };
}) {
  const CHARACTERS = ['Spider-Man', 'Black Widow', 'Iron Man', 'Hulk'];

  interface QueryData {
    character: {
      id: string;
      name: string;
    };
  }

  interface QueryVariables {
    id: string;
  }

  const query: TypedDocumentNode<QueryData, QueryVariables> = gql`
    query CharacterQuery($id: ID!) {
      character(id: $id) {
        id
        name
      }
    }
  `;

  const mocks = CHARACTERS.map((name, index) => ({
    request: { query, variables: { id: String(index + 1) } },
    result: { data: { character: { id: String(index + 1), name } } },
  }));
  const suspenseCache = new SuspenseCache();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });
  interface Renders {
    errors: Error[];
    errorCount: number;
    suspenseCount: number;
    count: number;
  }
  const renders: Renders = {
    errors: [],
    errorCount: 0,
    suspenseCount: 0,
    count: 0,
  };
  const errorBoundaryProps: ErrorBoundaryProps = {
    fallback: <div>Error</div>,
    onError: (error) => {
      renders.errorCount++;
      renders.errors.push(error);
    },
  };

  function SuspenseFallback() {
    renders.suspenseCount++;
    return <div>loading</div>;
  }

  function Child({
    subscription,
  }: {
    subscription: QuerySubscription<QueryData>;
  }) {
    const result = useReadQuery<QueryData>(subscription);
    return (
      <div>
        {result?.data?.character.id} - {result?.data?.character.name}
      </div>
    );
  }

  function ParentWithVariables({ variables }: { variables: QueryVariables }) {
    const { subscription } = useBackgroundQuery(query, { variables });
    // count renders in the parent component
    renders.count++;
    return <Child subscription={subscription} />;
  }

  function App({ variables }: { variables: QueryVariables }) {
    return (
      <ApolloProvider client={client} suspenseCache={suspenseCache}>
        <ErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            <ParentWithVariables variables={variables} />
          </Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const { ...rest } = render(<App variables={variables} />);
  return { ...rest, query, App, client, renders };
}

describe('useBackgroundQuery', () => {
  it('fetches a simple query with minimal config', async () => {
    const query = gql`
      query {
        hello
      }
    `;
    const suspenseCache = new SuspenseCache();
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world 1' } },
      },
    ];
    const { result } = renderHook(() => useBackgroundQuery(query), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={mocks} suspenseCache={suspenseCache}>
          {children}
        </MockedProvider>
      ),
    });

    const { subscription } = result.current;

    const _result = await subscription.promises.main;

    expect(_result).toEqual({
      data: { hello: 'world 1' },
      loading: false,
      networkStatus: 7,
    });
  });

  describe('fetch policy behaviors', () => {
    describe.skip('cache-and-network', () => {
      // TODO: should return cache data first if it exists
      it('returns initial cache data followed by network data', async () => {
        const query = gql`
          {
            hello
          }
        `;
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        cache.writeQuery({ query, data: { hello: 'from cache' } });

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'cache-and-network' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { subscription } = result.current;

        const _result = await subscription.promises.main;

        expect(_result).toEqual({
          data: { hello: 'from link' },
          loading: false,
          networkStatus: 7,
        });
      });
    });
    describe('cache-first', () => {
      it('all data is present in the cache, no network request is made', async () => {
        const query = gql`
          {
            hello
          }
        `;
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        cache.writeQuery({ query, data: { hello: 'from cache' } });

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'cache-first' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { subscription } = result.current;

        const _result = await subscription.promises.main;

        expect(_result).toEqual({
          data: { hello: 'from cache' },
          loading: false,
          networkStatus: 7,
        });
      });
      it('partial data is present in the cache so it is ignored and network request is made', async () => {
        const query = gql`
          {
            hello
            foo
          }
        `;
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link', foo: 'bar' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        // we expect a "Missing field 'foo' while writing result..." error
        // when writing hello to the cache, so we'll silence the console.error
        const originalConsoleError = console.error;
        console.error = () => {
          /* noop */
        };
        cache.writeQuery({ query, data: { hello: 'from cache' } });
        console.error = originalConsoleError;

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'cache-first' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { subscription } = result.current;

        const _result = await subscription.promises.main;

        expect(_result).toEqual({
          data: { foo: 'bar', hello: 'from link' },
          loading: false,
          networkStatus: 7,
        });
      });
    });
    describe('network-only', () => {
      it('existing data in the cache is ignored', async () => {
        const query = gql`
          {
            hello
          }
        `;
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        cache.writeQuery({ query, data: { hello: 'from cache' } });

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'network-only' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { subscription } = result.current;

        const _result = await subscription.promises.main;

        expect(_result).toEqual({
          data: { hello: 'from link' },
          loading: false,
          networkStatus: 7,
        });
        expect(client.cache.extract()).toEqual({
          ROOT_QUERY: { __typename: 'Query', hello: 'from link' },
        });
      });
    });
    describe('no-cache', () => {
      it('fetches data from the network but does not update the cache', async () => {
        const query = gql`
          {
            hello
          }
        `;
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        cache.writeQuery({ query, data: { hello: 'from cache' } });

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'no-cache' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { subscription } = result.current;

        const _result = await subscription.promises.main;

        expect(_result).toEqual({
          data: { hello: 'from link' },
          loading: false,
          networkStatus: 7,
        });
        // ...but not updated in the cache
        expect(client.cache.extract()).toEqual({
          ROOT_QUERY: { __typename: 'Query', hello: 'from cache' },
        });
      });
    });
  });

  describe('integration tests', () => {
    it('suspends and renders hello', async () => {
      const { renders } = renderIntegrationTest();
      // ensure the hook suspends immediately
      expect(renders.suspenseCount).toBe(1);
      expect(screen.getByText('loading')).toBeInTheDocument();

      // the parent component re-renders when promise fulfilled
      expect(await screen.findByText('hello')).toBeInTheDocument();
      expect(renders.count).toBe(2);
    });
  });

  it('reacts to cache updates', async () => {
    const { renders, client, query } = renderIntegrationTest();

    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText('loading')).toBeInTheDocument();

    // the parent component re-renders when promise fulfilled
    expect(await screen.findByText('hello')).toBeInTheDocument();
    expect(renders.count).toBe(2);

    client.writeQuery({
      query,
      data: { foo: { bar: 'baz' } },
    });

    // the parent component re-renders when promise fulfilled
    expect(await screen.findByText('baz')).toBeInTheDocument();

    expect(renders.suspenseCount).toBe(1);

    client.writeQuery({
      query,
      data: { foo: { bar: 'bat' } },
    });

    expect(await screen.findByText('bat')).toBeInTheDocument();

    expect(renders.suspenseCount).toBe(1);
  });

  it('reacts to variables updates', async () => {
    const { App, renders, rerender } = renderVariablesIntegrationTest({
      variables: { id: '1' },
    });

    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText('loading')).toBeInTheDocument();

    expect(await screen.findByText('1 - Spider-Man')).toBeInTheDocument();

    rerender(<App variables={{ id: '2' }} />);

    expect(renders.suspenseCount).toBe(2);
    expect(screen.getByText('loading')).toBeInTheDocument();

    expect(await screen.findByText('2 - Black Widow')).toBeInTheDocument();
  });

  it('passes context to the link', async () => {
    const query = gql`
      query ContextQuery {
        context
      }
    `;

    const link = new ApolloLink((operation) => {
      return new Observable((observer) => {
        const { valueA, valueB } = operation.getContext();

        observer.next({ data: { context: { valueA, valueB } } });
        observer.complete();
      });
    });

    const suspenseCache = new SuspenseCache();

    const { result } = renderHook(() => useBackgroundQuery(query, {
      context: { valueA: 'A', valueB: 'B' },
    }), {
      wrapper: ({ children }) => (
        <MockedProvider link={link} suspenseCache={suspenseCache}>
          {children}
        </MockedProvider>
      ),
    });

    const { subscription } = result.current;

    const _result = await subscription.promises.main;

    await waitFor(() => {
      expect(_result).toMatchObject({
        data: { context: { valueA: 'A', valueB: 'B' } },
        networkStatus: NetworkStatus.ready,
        // TODO: determine whether we should be returning `error` here
        // (it's present in equivalent useSuspenseQuery test)
        // error: undefined,
      });
    });
  });

  it('enables canonical results when canonizeResults is "true"', async () => {
    interface Result {
      __typename: string;
      value: number;
    }

    const cache = new InMemoryCache({
      typePolicies: {
        Result: {
          keyFields: false,
        },
      },
    });

    const query: TypedDocumentNode<{ results: Result[] }> = gql`
      query {
        results {
          value
        }
      }
    `;

    const results: Result[] = [
      { __typename: 'Result', value: 0 },
      { __typename: 'Result', value: 1 },
      { __typename: 'Result', value: 1 },
      { __typename: 'Result', value: 2 },
      { __typename: 'Result', value: 3 },
      { __typename: 'Result', value: 5 },
    ];

    cache.writeQuery({
      query,
      data: { results },
    });

    const suspenseCache = new SuspenseCache();

    const { result } = renderHook(() => useBackgroundQuery(query, {
      canonizeResults: true,
    }), {
      wrapper: ({ children }) => (
        <MockedProvider cache={cache} suspenseCache={suspenseCache}>
          {children}
        </MockedProvider>
      ),
    });

    const { subscription } = result.current;

    const _result = await subscription.promises.main;
    const resultSet = new Set(_result.data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(_result.data).toEqual({ results });
    expect(_result.data.results.length).toBe(6);
    expect(resultSet.size).toBe(5);
    expect(values).toEqual([0, 1, 2, 3, 5]);
  });

  it("can disable canonical results when the cache's canonizeResults setting is true", async () => {
    interface Result {
      __typename: string;
      value: number;
    }

    const cache = new InMemoryCache({
      canonizeResults: true,
      typePolicies: {
        Result: {
          keyFields: false,
        },
      },
    });

    const query: TypedDocumentNode<{ results: Result[] }> = gql`
      query {
        results {
          value
        }
      }
    `;

    const results: Result[] = [
      { __typename: 'Result', value: 0 },
      { __typename: 'Result', value: 1 },
      { __typename: 'Result', value: 1 },
      { __typename: 'Result', value: 2 },
      { __typename: 'Result', value: 3 },
      { __typename: 'Result', value: 5 },
    ];

    cache.writeQuery({
      query,
      data: { results },
    });

    const suspenseCache = new SuspenseCache();

    const { result } = renderHook(() => useBackgroundQuery(query, {
      canonizeResults: false,
    }), {
      wrapper: ({ children }) => (
        <MockedProvider cache={cache} suspenseCache={suspenseCache}>
          {children}
        </MockedProvider>
      ),
    });

    const { subscription } = result.current;

    const _result = await subscription.promises.main;
    const resultSet = new Set(_result.data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(_result.data).toEqual({ results });
    expect(_result.data.results.length).toBe(6);
    expect(resultSet.size).toBe(6);
    expect(values).toEqual([0, 1, 1, 2, 3, 5]);
  });
});
