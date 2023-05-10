import React, { Fragment, StrictMode, Suspense } from 'react';
import {
  act,
  render,
  screen,
  renderHook,
  RenderHookOptions,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary, ErrorBoundaryProps } from 'react-error-boundary';
import { GraphQLError } from 'graphql';
import {
  gql,
  ApolloError,
  DocumentNode,
  ApolloClient,
  ErrorPolicy,
  NormalizedCacheObject,
  NetworkStatus,
  ApolloCache,
  TypedDocumentNode,
  ApolloLink,
  Observable,
  FetchMoreQueryOptions,
  OperationVariables,
  ApolloQueryResult,
} from '../../../core';
import {
  MockedResponse,
  MockedProvider,
  MockLink,
  MockSubscriptionLink,
  mockSingleLink,
} from '../../../testing';
import {
  useBackgroundQuery_experimental as useBackgroundQuery,
  useReadQuery_experimental as useReadQuery,
} from '../useBackgroundQuery';
import { ApolloProvider } from '../../context';
import { SuspenseCache } from '../../cache';
import { InMemoryCache } from '../../../cache';
import { FetchMoreFunction } from '../../../react';
import { QuerySubscription } from '../../cache/QuerySubscription';

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
  mocks,
  errorPolicy,
}: {
  mocks?: {
    request: { query: DocumentNode; variables: { id: string } };
    result: {
      data?: {
        character: {
          id: string;
          name: string | null;
        };
      };
    };
  }[];
  variables: { id: string };
  errorPolicy?: ErrorPolicy;
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

  let _mocks = [...CHARACTERS].map((name, index) => ({
    request: { query, variables: { id: String(index + 1) } },
    result: { data: { character: { id: String(index + 1), name } } },
  }));
  // duplicate mocks with (updated) in the name for refetches
  _mocks = [..._mocks, ..._mocks, ..._mocks].map(
    ({ request, result }, index) => {
      return {
        request: request,
        result: {
          data: {
            character: {
              ...result.data.character,
              name:
                index > 3
                  ? index > 7
                    ? `${result.data.character.name} (updated again)`
                    : `${result.data.character.name} (updated)`
                  : result.data.character.name,
            },
          },
        },
      };
    }
  );
  const suspenseCache = new SuspenseCache();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks || _mocks),
  });
  interface Renders {
    errors: Error[];
    errorCount: number;
    suspenseCount: number;
    count: number;
    frames: {
      data: QueryData;
      networkStatus: NetworkStatus;
      error: ApolloError | undefined;
    }[];
  }
  const renders: Renders = {
    errors: [],
    errorCount: 0,
    suspenseCount: 0,
    count: 0,
    frames: [],
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
    refetch,
    variables: _variables,
    subscription,
  }: {
    variables: QueryVariables;
    refetch: (
      variables?: Partial<OperationVariables> | undefined
    ) => Promise<ApolloQueryResult<QueryData>>;
    subscription: QuerySubscription<QueryData>;
  }) {
    const { data, error, networkStatus } =
      useReadQuery<QueryData>(subscription);
    const [variables, setVariables] = React.useState(_variables);

    renders.frames.push({ data, networkStatus, error });

    return (
      <div>
        {error ? <div>{error.message}</div> : null}
        <button
          onClick={() => {
            refetch(variables);
          }}
        >
          Refetch
        </button>
        <button
          onClick={() => {
            setVariables({ id: '2' });
          }}
        >
          Set variables to id: 2
        </button>
        {data?.character.id} - {data?.character.name}
      </div>
    );
  }

  function ParentWithVariables({
    variables,
    errorPolicy = 'none',
  }: {
    variables: QueryVariables;
    errorPolicy?: ErrorPolicy;
  }) {
    const { subscription, refetch } = useBackgroundQuery(query, {
      variables,
      errorPolicy,
    });
    // count renders in the parent component
    renders.count++;
    return (
      <Child
        refetch={refetch}
        variables={variables}
        subscription={subscription}
      />
    );
  }

  function App({
    variables,
    errorPolicy,
  }: {
    variables: QueryVariables;
    errorPolicy?: ErrorPolicy;
  }) {
    return (
      <ApolloProvider client={client} suspenseCache={suspenseCache}>
        <ErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            <ParentWithVariables
              variables={variables}
              errorPolicy={errorPolicy}
            />
          </Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const { ...rest } = render(
    <App errorPolicy={errorPolicy} variables={variables} />
  );
  return { ...rest, query, App, client, renders };
}

function renderPaginatedIntegrationTest({
  updateQuery,
  mocks,
}: {
  updateQuery?: boolean;
  mocks?: {
    request: {
      query: DocumentNode;
      variables: { offset: number; limit: number };
    };
    result: {
      data: {
        letters: {
          letter: string;
          position: number;
        }[];
      };
    };
  }[];
} = {}) {
  interface QueryData {
    letters: {
      letter: string;
      position: number;
    }[];
  }

  interface Variables {
    limit?: number;
    offset?: number;
  }

  const query: TypedDocumentNode<QueryData, Variables> = gql`
    query letters($limit: Int, $offset: Int) {
      letters(limit: $limit) {
        letter
        position
      }
    }
  `;

  const data = 'ABCDEFG'
    .split('')
    .map((letter, index) => ({ letter, position: index + 1 }));

  const _mocks = [
    {
      request: { query, variables: { offset: 0, limit: 2 } },
      result: {
        data: {
          letters: [
            { letter: 'A', position: 1 },
            { letter: 'B', position: 2 },
          ],
        },
      },
    },
    {
      request: { query, variables: { offset: 0, limit: 2 } },
      result: {
        data: {
          letters: [
            { letter: 'C', position: 3 },
            { letter: 'D', position: 4 },
          ],
        },
      },
    },
  ];

  const suspenseCache = new SuspenseCache();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks || _mocks),
  });
  interface Renders {
    errors: Error[];
    errorCount: number;
    suspenseCount: number;
    count: number;
    frames: {
      data: QueryData;
      networkStatus: NetworkStatus;
      error: ApolloError | undefined;
    }[];
  }
  const renders: Renders = {
    errors: [],
    errorCount: 0,
    suspenseCount: 0,
    count: 0,
    frames: [],
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
    fetchMore,
  }: {
    fetchMore: FetchMoreFunction<QueryData, OperationVariables>;
    subscription: QuerySubscription<QueryData>;
  }) {
    const { data, error, networkStatus } =
      useReadQuery<QueryData>(subscription);

    renders.frames.push({ data, networkStatus, error });

    return (
      <div>
        {error ? <div>{error.message}</div> : null}
        <button
          onClick={() => {
            const fetchMoreOpts: FetchMoreQueryOptions<Variables, QueryData> & {
              updateQuery?: (
                previousQueryResult: QueryData,
                options: {
                  fetchMoreResult: QueryData;
                  variables: Variables;
                }
              ) => QueryData;
            } = { variables: { offset: 0, limit: 2 } };

            if (updateQuery) {
              fetchMoreOpts.updateQuery = (prev, { fetchMoreResult }) => ({
                letters: prev.letters.concat(fetchMoreResult.letters),
              });
            }

            fetchMore(fetchMoreOpts);
          }}
        >
          Fetch more
        </button>
        <ul>
          {data.letters.map(({ letter, position }) => (
            <li key={position}>Letter: {letter}</li>
          ))}
        </ul>
      </div>
    );
  }

  function ParentWithVariables() {
    const { subscription, fetchMore } = useBackgroundQuery(query, {
      variables: { limit: 2, offset: 0 },
    });
    // count renders in the parent component
    renders.count++;
    return <Child fetchMore={fetchMore} subscription={subscription} />;
  }

  function App() {
    return (
      <ApolloProvider client={client} suspenseCache={suspenseCache}>
        <ErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            <ParentWithVariables />
          </Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const { ...rest } = render(<App />);
  return { ...rest, data, query, App, client, renders };
}

type RenderSuspenseHookOptions<Props, TSerializedCache = {}> = Omit<
  RenderHookOptions<Props>,
  'wrapper'
> & {
  client?: ApolloClient<TSerializedCache>;
  link?: ApolloLink;
  cache?: ApolloCache<TSerializedCache>;
  mocks?: MockedResponse[];
  suspenseCache?: SuspenseCache;
  strictMode?: boolean;
};

interface Renders<Result> {
  errors: Error[];
  errorCount: number;
  suspenseCount: number;
  count: number;
  frames: Result[];
}

interface SimpleQueryData {
  greeting: string;
}

function renderSuspenseHook<Result, Props>(
  render: (initialProps: Props) => Result,
  options: RenderSuspenseHookOptions<Props> = Object.create(null)
) {
  function SuspenseFallback() {
    renders.suspenseCount++;

    return <div>loading</div>;
  }

  const renders: Renders<Result> = {
    errors: [],
    errorCount: 0,
    suspenseCount: 0,
    count: 0,
    frames: [],
  };

  const {
    mocks = [],
    suspenseCache = new SuspenseCache(),
    strictMode,
    ...renderHookOptions
  } = options;

  const client =
    options.client ||
    new ApolloClient({
      cache: options.cache || new InMemoryCache(),
      link: options.link || new MockLink(mocks),
    });

  const view = renderHook(
    (props) => {
      renders.count++;

      const view = render(props);

      renders.frames.push(view);

      return view;
    },
    {
      ...renderHookOptions,
      wrapper: ({ children }) => {
        const Wrapper = strictMode ? StrictMode : Fragment;

        return (
          <Wrapper>
            <Suspense fallback={<SuspenseFallback />}>
              <ErrorBoundary
                fallback={<div>Error</div>}
                onError={(error) => {
                  renders.errorCount++;
                  renders.errors.push(error);
                }}
              >
                <ApolloProvider client={client} suspenseCache={suspenseCache}>
                  {children}
                </ApolloProvider>
              </ErrorBoundary>
            </Suspense>
          </Wrapper>
        );
      },
    }
  );

  return { ...view, renders };
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

  describe('hook options', () => {
    it('allows the client to be overridden', async () => {
      const query: TypedDocumentNode<SimpleQueryData> = gql`
        query UserQuery {
          greeting
        }
      `;

      const globalClient = new ApolloClient({
        link: new ApolloLink(() =>
          Observable.of({ data: { greeting: 'global hello' } })
        ),
        cache: new InMemoryCache(),
      });

      const localClient = new ApolloClient({
        link: new ApolloLink(() =>
          Observable.of({ data: { greeting: 'local hello' } })
        ),
        cache: new InMemoryCache(),
      });

      const { result } = renderSuspenseHook(
        () => useBackgroundQuery(query, { client: localClient }),
        { client: globalClient }
      );

      const { subscription } = result.current;

      const _result = await subscription.promises.main;

      await waitFor(() => {
        expect(_result).toEqual({
          data: { greeting: 'local hello' },
          loading: false,
          networkStatus: NetworkStatus.ready,
        });
      });
    });

    it('prioritizes the `suspenseCache` option over the context value', () => {
      const query: TypedDocumentNode<SimpleQueryData> = gql`
        query UserQuery {
          greeting
        }
      `;

      const mocks = [
        {
          request: { query },
          result: { data: { greeting: 'Hello' } },
        },
      ];

      const directSuspenseCache = new SuspenseCache();
      const contextSuspenseCache = new SuspenseCache();

      const client = new ApolloClient({
        link: new MockLink(mocks),
        cache: new InMemoryCache(),
      });

      renderHook(
        () => useBackgroundQuery(query, { suspenseCache: directSuspenseCache }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider
              client={client}
              suspenseCache={contextSuspenseCache}
            >
              {children}
            </ApolloProvider>
          ),
        }
      );

      expect(directSuspenseCache['subscriptions'].size).toBe(1);
      expect(contextSuspenseCache['subscriptions'].size).toBe(0);
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

      const { result } = renderHook(
        () =>
          useBackgroundQuery(query, {
            context: { valueA: 'A', valueB: 'B' },
          }),
        {
          wrapper: ({ children }) => (
            <MockedProvider link={link} suspenseCache={suspenseCache}>
              {children}
            </MockedProvider>
          ),
        }
      );

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

      const { result } = renderHook(
        () =>
          useBackgroundQuery(query, {
            canonizeResults: true,
          }),
        {
          wrapper: ({ children }) => (
            <MockedProvider cache={cache} suspenseCache={suspenseCache}>
              {children}
            </MockedProvider>
          ),
        }
      );

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

      const { result } = renderHook(
        () =>
          useBackgroundQuery(query, {
            canonizeResults: false,
          }),
        {
          wrapper: ({ children }) => (
            <MockedProvider cache={cache} suspenseCache={suspenseCache}>
              {children}
            </MockedProvider>
          ),
        }
      );

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

  describe('integration tests with useReadQuery', () => {
    it('suspends and renders hello', async () => {
      const { renders } = renderIntegrationTest();
      // ensure the hook suspends immediately
      expect(renders.suspenseCount).toBe(1);
      expect(screen.getByText('loading')).toBeInTheDocument();

      // the parent component re-renders when promise fulfilled
      expect(await screen.findByText('hello')).toBeInTheDocument();
      expect(renders.count).toBe(2);
    });

    it('works with startTransition to change variables', async () => {
      type Variables = {
        id: string;
      };

      interface Data {
        todo: {
          id: string;
          name: string;
          completed: boolean;
        };
      }
      const user = userEvent.setup();

      const query: TypedDocumentNode<Data, Variables> = gql`
        query TodoItemQuery($id: ID!) {
          todo(id: $id) {
            id
            name
            completed
          }
        }
      `;

      const mocks: MockedResponse<Data, Variables>[] = [
        {
          request: { query, variables: { id: '1' } },
          result: {
            data: { todo: { id: '1', name: 'Clean room', completed: false } },
          },
          delay: 10,
        },
        {
          request: { query, variables: { id: '2' } },
          result: {
            data: {
              todo: { id: '2', name: 'Take out trash', completed: true },
            },
          },
          delay: 10,
        },
      ];

      const client = new ApolloClient({
        link: new MockLink(mocks),
        cache: new InMemoryCache(),
      });

      const suspenseCache = new SuspenseCache();

      function App() {
        return (
          <ApolloProvider client={client} suspenseCache={suspenseCache}>
            <Suspense fallback={<SuspenseFallback />}>
              <Parent />
            </Suspense>
          </ApolloProvider>
        );
      }

      function SuspenseFallback() {
        return <p>Loading</p>;
      }

      function Parent() {
        const [id, setId] = React.useState('1');
        const { subscription } = useBackgroundQuery(query, {
          variables: { id },
        });
        return <Todo subscription={subscription} onChange={setId} />;
      }

      function Todo({
        subscription,
        onChange,
      }: {
        subscription: QuerySubscription<Data>;
        onChange: (id: string) => void;
      }) {
        const { data } = useReadQuery<Data>(subscription);
        const [isPending, startTransition] = React.useTransition();
        const { todo } = data;

        return (
          <>
            <button
              onClick={() => {
                startTransition(() => {
                  onChange('2');
                });
              }}
            >
              Refresh
            </button>
            <div data-testid="todo" aria-busy={isPending}>
              {todo.name}
              {todo.completed && ' (completed)'}
            </div>
          </>
        );
      }

      render(<App />);

      expect(screen.getByText('Loading')).toBeInTheDocument();

      expect(await screen.findByTestId('todo')).toBeInTheDocument();

      const todo = screen.getByTestId('todo');
      const button = screen.getByText('Refresh');

      expect(todo).toHaveTextContent('Clean room');

      await act(() => user.click(button));

      // startTransition will avoid rendering the suspense fallback for already
      // revealed content if the state update inside the transition causes the
      // component to suspend.
      //
      // Here we should not see the suspense fallback while the component suspends
      // until the todo is finished loading. Seeing the suspense fallback is an
      // indication that we are suspending the component too late in the process.
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();

      // We can ensure this works with isPending from useTransition in the process
      expect(todo).toHaveAttribute('aria-busy', 'true');

      // Ensure we are showing the stale UI until the new todo has loaded
      expect(todo).toHaveTextContent('Clean room');

      // Eventually we should see the updated todo content once its done
      // suspending.
      await waitFor(() => {
        expect(todo).toHaveTextContent('Take out trash (completed)');
      });
    });

    it('does not suspend deferred queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
      const query = gql`
        query {
          greeting {
            message
            ... on Greeting @defer {
              recipient {
                name
              }
            }
          }
        }
      `;

      interface Data {
        greeting: {
          message: string;
          recipient: { name: string };
        };
      }

      const link = new MockSubscriptionLink();
      const cache = new InMemoryCache();
      cache.writeQuery({
        query,
        data: {
          greeting: {
            __typename: 'Greeting',
            message: 'Hello cached',
            recipient: { __typename: 'Person', name: 'Cached Alice' },
          },
        },
      });
      const client = new ApolloClient({ cache, link });
      const suspenseCache = new SuspenseCache();
      let renders = 0;
      let suspenseCount = 0;

      function App() {
        return (
          <ApolloProvider client={client} suspenseCache={suspenseCache}>
            <Suspense fallback={<SuspenseFallback />}>
              <Parent />
            </Suspense>
          </ApolloProvider>
        );
      }

      function SuspenseFallback() {
        suspenseCount++;
        return <p>Loading</p>;
      }

      function Parent() {
        const { subscription } = useBackgroundQuery(query, {
          fetchPolicy: 'cache-and-network',
        });
        return <Todo subscription={subscription} />;
      }

      function Todo({
        subscription,
      }: {
        subscription: QuerySubscription<Data>;
      }) {
        const { data, networkStatus, error } = useReadQuery<Data>(subscription);
        const { greeting } = data;
        renders++;
        // console.log({ greeting: JSON.stringify(greeting, null, 2) });

        return (
          <>
            <div>Message: {greeting.message}</div>
            <div>Recipient: {greeting.recipient.name}</div>
            <div>Network status: {networkStatus}</div>
            <div>Error: {error ? error.message : 'none'}</div>
          </>
        );
      }

      render(<App />);

      expect(screen.getByText(/Message/i)).toHaveTextContent(
        'Message: Hello cached'
      );
      expect(screen.getByText(/Recipient/i)).toHaveTextContent(
        'Recipient: Cached Alice'
      );
      expect(screen.getByText(/Network status/i)).toHaveTextContent(
        'Network status: 1' // loading
      );
      expect(screen.getByText(/Error/i)).toHaveTextContent(
        'none'
      );

      link.simulateResult({
        result: {
          data: {
            greeting: { __typename: 'Greeting', message: 'Hello world' },
          },
          hasNext: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/Message/i)).toHaveTextContent(
          'Message: Hello world'
        );
      });
      expect(screen.getByText(/Recipient/i)).toHaveTextContent(
        'Recipient: Cached Alice'
      );
      expect(screen.getByText(/Network status/i)).toHaveTextContent(
        'Network status: 7' // ready
      );
      expect(screen.getByText(/Error/i)).toHaveTextContent(
        'none'
      );

      link.simulateResult({
        result: {
          incremental: [
            {
              data: {
                recipient: { name: 'Alice', __typename: 'Person' },
                __typename: 'Greeting',
              },
              path: ['greeting'],
            },
          ],
          hasNext: false,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/Recipient/i)).toHaveTextContent(
          'Recipient: Alice'
        );
      });
      expect(screen.getByText(/Message/i)).toHaveTextContent(
        'Message: Hello world'
      );
      expect(screen.getByText(/Network status/i)).toHaveTextContent(
        'Network status: 7' // ready
      );
      expect(screen.getByText(/Error/i)).toHaveTextContent(
        'none'
      );

      expect(renders).toBe(3);
      expect(suspenseCount).toBe(0);
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

  describe('refetch', () => {
    it('re-suspends when calling `refetch`', async () => {
      const { renders } = renderVariablesIntegrationTest({
        variables: { id: '1' },
      });

      expect(renders.suspenseCount).toBe(1);
      expect(screen.getByText('loading')).toBeInTheDocument();

      expect(await screen.findByText('1 - Spider-Man')).toBeInTheDocument();

      const button = screen.getByText('Refetch');
      const user = userEvent.setup();
      await act(() => user.click(button));

      // parent component re-suspends
      expect(renders.suspenseCount).toBe(2);
      // TODO: investigate why this is 1 more render than equivalent
      // useSuspenseQuery test
      expect(renders.count).toBe(5);

      expect(
        await screen.findByText('1 - Spider-Man (updated)')
      ).toBeInTheDocument();
    });
    it('re-suspends when calling `refetch` with new variables', async () => {
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

      const mocks = [
        {
          request: { query, variables: { id: '1' } },
          result: {
            data: { character: { id: '1', name: 'Captain Marvel' } },
          },
        },
        {
          request: { query, variables: { id: '2' } },
          result: {
            data: { character: { id: '2', name: 'Captain America' } },
          },
        },
      ];

      const { renders } = renderVariablesIntegrationTest({
        variables: { id: '1' },
        mocks,
      });

      expect(renders.suspenseCount).toBe(1);
      expect(screen.getByText('loading')).toBeInTheDocument();

      expect(await screen.findByText('1 - Captain Marvel')).toBeInTheDocument();

      const newVariablesRefetchButton = screen.getByText(
        'Set variables to id: 2'
      );
      const refetchButton = screen.getByText('Refetch');
      const user = userEvent.setup();
      await act(() => user.click(newVariablesRefetchButton));
      await act(() => user.click(refetchButton));

      expect(
        await screen.findByText('2 - Captain America')
      ).toBeInTheDocument();

      // parent component re-suspends
      expect(renders.suspenseCount).toBe(2);
      // TODO: investigate why this is 1 more render than equivalent
      // useSuspenseQuery test
      expect(renders.count).toBe(5);

      // extra render puts an additional frame into the array
      expect(renders.frames).toMatchObject([
        {
          ...mocks[0].result,
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
        {
          ...mocks[0].result,
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
        {
          ...mocks[1].result,
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
      ]);
    });
    it('re-suspends multiple times when calling `refetch` multiple times', async () => {
      const { renders } = renderVariablesIntegrationTest({
        variables: { id: '1' },
      });

      expect(renders.suspenseCount).toBe(1);
      expect(screen.getByText('loading')).toBeInTheDocument();

      expect(await screen.findByText('1 - Spider-Man')).toBeInTheDocument();

      const button = screen.getByText('Refetch');
      const user = userEvent.setup();
      await act(() => user.click(button));

      // parent component re-suspends
      expect(renders.suspenseCount).toBe(2);
      // TODO: investigate why this is +1 render than equivalent
      // useSuspenseQuery test
      expect(renders.count).toBe(5);

      expect(
        await screen.findByText('1 - Spider-Man (updated)')
      ).toBeInTheDocument();

      await act(() => user.click(button));

      // parent component re-suspends
      expect(renders.suspenseCount).toBe(3);
      // TODO: investigate why this is now +2 renders than equivalent
      // useSuspenseQuery test
      expect(renders.count).toBe(8);

      expect(
        await screen.findByText('1 - Spider-Man (updated again)')
      ).toBeInTheDocument();
    });
    it('throws errors when errors are returned after calling `refetch`', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
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
      const mocks = [
        {
          request: { query, variables: { id: '1' } },
          result: {
            data: { character: { id: '1', name: 'Captain Marvel' } },
          },
        },
        {
          request: { query, variables: { id: '1' } },
          result: {
            errors: [new GraphQLError('Something went wrong')],
          },
        },
      ];
      const { renders } = renderVariablesIntegrationTest({
        variables: { id: '1' },
        mocks,
      });

      expect(renders.suspenseCount).toBe(1);
      expect(screen.getByText('loading')).toBeInTheDocument();

      expect(await screen.findByText('1 - Captain Marvel')).toBeInTheDocument();

      const button = screen.getByText('Refetch');
      const user = userEvent.setup();
      await act(() => user.click(button));

      await waitFor(() => {
        expect(renders.errorCount).toBe(1);
      });

      expect(renders.errors).toEqual([
        new ApolloError({
          graphQLErrors: [new GraphQLError('Something went wrong')],
        }),
      ]);

      consoleSpy.mockRestore();
    });
    it('ignores errors returned after calling `refetch` when errorPolicy is set to "ignore"', async () => {
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
      const mocks = [
        {
          request: { query, variables: { id: '1' } },
          result: {
            data: { character: { id: '1', name: 'Captain Marvel' } },
          },
        },
        {
          request: { query, variables: { id: '1' } },
          result: {
            errors: [new GraphQLError('Something went wrong')],
          },
        },
      ];

      const { renders } = renderVariablesIntegrationTest({
        variables: { id: '1' },
        errorPolicy: 'ignore',
        mocks,
      });

      expect(await screen.findByText('1 - Captain Marvel')).toBeInTheDocument();

      const button = screen.getByText('Refetch');
      const user = userEvent.setup();
      await act(() => user.click(button));

      expect(renders.errorCount).toBe(0);
      expect(renders.errors).toEqual([]);
    });
    it('returns errors after calling `refetch` when errorPolicy is set to "all"', async () => {
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
      const mocks = [
        {
          request: { query, variables: { id: '1' } },
          result: {
            data: { character: { id: '1', name: 'Captain Marvel' } },
          },
        },
        {
          request: { query, variables: { id: '1' } },
          result: {
            errors: [new GraphQLError('Something went wrong')],
          },
        },
      ];

      const { renders } = renderVariablesIntegrationTest({
        variables: { id: '1' },
        errorPolicy: 'all',
        mocks,
      });

      expect(await screen.findByText('1 - Captain Marvel')).toBeInTheDocument();

      const button = screen.getByText('Refetch');
      const user = userEvent.setup();
      await act(() => user.click(button));

      expect(renders.errorCount).toBe(0);
      expect(renders.errors).toEqual([]);

      expect(
        await screen.findByText('Something went wrong')
      ).toBeInTheDocument();
    });
    it('handles partial data results after calling `refetch` when errorPolicy is set to "all"', async () => {
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
      const mocks = [
        {
          request: { query, variables: { id: '1' } },
          result: {
            data: { character: { id: '1', name: 'Captain Marvel' } },
          },
        },
        {
          request: { query, variables: { id: '1' } },
          result: {
            data: { character: { id: '1', name: null } },
            errors: [new GraphQLError('Something went wrong')],
          },
        },
      ];

      const { renders } = renderVariablesIntegrationTest({
        variables: { id: '1' },
        errorPolicy: 'all',
        mocks,
      });

      expect(await screen.findByText('1 - Captain Marvel')).toBeInTheDocument();

      const button = screen.getByText('Refetch');
      const user = userEvent.setup();
      await act(() => user.click(button));

      expect(renders.errorCount).toBe(0);
      expect(renders.errors).toEqual([]);

      expect(
        await screen.findByText('Something went wrong')
      ).toBeInTheDocument();

      const expectedError = new ApolloError({
        graphQLErrors: [new GraphQLError('Something went wrong')],
      });

      expect(renders.frames).toMatchObject([
        {
          ...mocks[0].result,
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
        {
          data: mocks[1].result.data,
          networkStatus: NetworkStatus.error,
          error: expectedError,
        },
      ]);
    });
    it('`refetch` works with startTransition to allow React to show stale UI until finished suspending', async () => {
      type Variables = {
        id: string;
      };

      interface Data {
        todo: {
          id: string;
          name: string;
          completed: boolean;
        };
      }
      const user = userEvent.setup();

      const query: TypedDocumentNode<Data, Variables> = gql`
        query TodoItemQuery($id: ID!) {
          todo(id: $id) {
            id
            name
            completed
          }
        }
      `;

      const mocks: MockedResponse<Data, Variables>[] = [
        {
          request: { query, variables: { id: '1' } },
          result: {
            data: { todo: { id: '1', name: 'Clean room', completed: false } },
          },
          delay: 10,
        },
        {
          request: { query, variables: { id: '1' } },
          result: {
            data: { todo: { id: '1', name: 'Clean room', completed: true } },
          },
          delay: 10,
        },
      ];

      const client = new ApolloClient({
        link: new MockLink(mocks),
        cache: new InMemoryCache(),
      });

      const suspenseCache = new SuspenseCache();

      function App() {
        return (
          <ApolloProvider client={client} suspenseCache={suspenseCache}>
            <Suspense fallback={<SuspenseFallback />}>
              <Parent />
            </Suspense>
          </ApolloProvider>
        );
      }

      function SuspenseFallback() {
        return <p>Loading</p>;
      }

      function Parent() {
        const [id, setId] = React.useState('1');
        const { subscription, refetch } = useBackgroundQuery(query, {
          variables: { id },
        });
        return (
          <Todo
            refetch={refetch}
            subscription={subscription}
            onChange={setId}
          />
        );
      }

      function Todo({
        subscription,
        onChange,
        refetch,
      }: {
        refetch: (
          variables?: Partial<OperationVariables> | undefined
        ) => Promise<ApolloQueryResult<Data>>;
        subscription: QuerySubscription<Data>;
        onChange: (id: string) => void;
      }) {
        const { data } = useReadQuery<Data>(subscription);
        const [isPending, startTransition] = React.useTransition();
        const { todo } = data;

        return (
          <>
            <button
              onClick={() => {
                startTransition(() => {
                  refetch();
                });
              }}
            >
              Refresh
            </button>
            <div data-testid="todo" aria-busy={isPending}>
              {todo.name}
              {todo.completed && ' (completed)'}
            </div>
          </>
        );
      }

      render(<App />);

      expect(screen.getByText('Loading')).toBeInTheDocument();

      expect(await screen.findByTestId('todo')).toBeInTheDocument();

      const todo = screen.getByTestId('todo');
      const button = screen.getByText('Refresh');

      expect(todo).toHaveTextContent('Clean room');

      await act(() => user.click(button));

      // startTransition will avoid rendering the suspense fallback for already
      // revealed content if the state update inside the transition causes the
      // component to suspend.
      //
      // Here we should not see the suspense fallback while the component suspends
      // until the todo is finished loading. Seeing the suspense fallback is an
      // indication that we are suspending the component too late in the process.
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();

      // We can ensure this works with isPending from useTransition in the process
      expect(todo).toHaveAttribute('aria-busy', 'true');

      // Ensure we are showing the stale UI until the new todo has loaded
      expect(todo).toHaveTextContent('Clean room');

      // Eventually we should see the updated todo content once its done
      // suspending.
      await waitFor(() => {
        expect(todo).toHaveTextContent('Clean room (completed)');
      });
    });
  });

  describe('fetchMore', () => {
    it('re-suspends when calling `fetchMore` with different variables', async () => {
      const { renders, data } = renderPaginatedIntegrationTest();

      expect(renders.suspenseCount).toBe(1);
      expect(screen.getByText('loading')).toBeInTheDocument();

      const items = await screen.findAllByText(/Letter: /);
      expect(items).toHaveLength(2);

      expect(renders.frames).toMatchObject([
        {
          data: {
            letters: data.slice(0, 2),
          },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      ]);

      const button = screen.getByText('Fetch more');
      const user = userEvent.setup();
      await act(() => user.click(button));

      // parent component re-suspends
      expect(renders.suspenseCount).toBe(2);
      expect(renders.count).toBe(4);

      expect(renders.frames).toMatchObject([
        {
          data: { letters: data.slice(0, 2) },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
        {
          data: { letters: data.slice(2, 4) },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
        {
          data: { letters: data.slice(2, 4) },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      ]);
    });
    it('properly uses `updateQuery` when calling `fetchMore`', async () => {
      interface QueryData {
        letters: {
          letter: string;
          position: string;
        }[];
      }

      interface Variables {
        limit?: number;
        offset?: number;
      }

      const query: TypedDocumentNode<QueryData, Variables> = gql`
        query letters($limit: Int, $offset: Int) {
          letters(limit: $limit) {
            letter
            position
          }
        }
      `;

      const mocks = [
        {
          request: { query, variables: { offset: 0, limit: 2 } },
          result: {
            data: {
              letters: [
                { letter: 'A', position: 1 },
                { letter: 'B', position: 2 },
              ],
            },
          },
        },
        {
          request: { query, variables: { offset: 0, limit: 2 } },
          result: {
            data: {
              letters: [
                { letter: 'A', position: 1 },
                { letter: 'B', position: 2 },
                { letter: 'C', position: 3 },
                { letter: 'D', position: 4 },
              ],
            },
          },
        },
      ];
      const { renders, data } = renderPaginatedIntegrationTest({
        updateQuery: true,
        mocks,
      });

      expect(renders.suspenseCount).toBe(1);
      expect(screen.getByText('loading')).toBeInTheDocument();

      const items = await screen.findAllByText(/Letter: /);
      expect(items).toHaveLength(2);

      expect(renders.frames).toMatchObject([
        {
          data: {
            letters: data.slice(0, 2),
          },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      ]);

      const button = screen.getByText('Fetch more');
      const user = userEvent.setup();
      await act(() => user.click(button));

      // parent component re-suspends
      expect(renders.suspenseCount).toBe(2);
      expect(renders.count).toBe(4);

      expect(renders.frames).toMatchObject([
        {
          data: { letters: data.slice(0, 2) },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
        {
          data: { letters: data.slice(0, 4) },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
        {
          data: { letters: data.slice(0, 4) },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      ]);
    });
    it.skip('properly uses cache field policies when calling `fetchMore` without `updateQuery`', async () => {});
    it.skip('`fetchMore` works with startTransition to allow React to show stale UI until finished suspending', async () => {});
  });
});
