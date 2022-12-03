import React, { Suspense } from 'react';
import {
  act,
  screen,
  renderHook,
  waitFor,
  RenderHookOptions,
} from '@testing-library/react';
import { ErrorBoundary, ErrorBoundaryProps } from 'react-error-boundary';
import { GraphQLError } from 'graphql';
import { InvariantError } from 'ts-invariant';
import { equal } from '@wry/equality';

import {
  gql,
  ApolloCache,
  ApolloClient,
  ApolloError,
  ApolloLink,
  DocumentNode,
  InMemoryCache,
  Observable,
  TypedDocumentNode,
} from '../../../core';
import { compact, concatPagination } from '../../../utilities';
import {
  MockedProvider,
  MockedResponse,
  MockSubscriptionLink,
  MockLink,
} from '../../../testing';
import { ApolloProvider } from '../../context';
import { SuspenseCache } from '../../cache';
import { SuspenseQueryHookFetchPolicy } from '../../../react';
import { useSuspenseQuery_experimental as useSuspenseQuery } from '../useSuspenseQuery';

type RenderSuspenseHookOptions<
  Props,
  TSerializedCache = {}
> = RenderHookOptions<Props> & {
  client?: ApolloClient<TSerializedCache>;
  link?: ApolloLink;
  cache?: ApolloCache<TSerializedCache>;
  mocks?: MockedResponse[];
  suspenseCache?: SuspenseCache;
};

interface Renders<Result> {
  errors: Error[];
  errorCount: number;
  suspenseCount: number;
  count: number;
  frames: Result[];
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
    cache,
    client,
    link,
    mocks = [],
    suspenseCache = new SuspenseCache(),
    wrapper = ({ children }) => {
      const errorBoundaryProps: ErrorBoundaryProps = {
        fallback: <div>Error</div>,
        onError: (error) => {
          renders.errorCount++;
          renders.errors.push(error);
        },
      };

      return client ? (
        <ApolloProvider client={client} suspenseCache={suspenseCache}>
          <ErrorBoundary {...errorBoundaryProps}>
            <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>
          </ErrorBoundary>
        </ApolloProvider>
      ) : (
        <MockedProvider
          cache={cache}
          mocks={mocks}
          link={link}
          suspenseCache={suspenseCache}
        >
          <ErrorBoundary {...errorBoundaryProps}>
            <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>
          </ErrorBoundary>
        </MockedProvider>
      );
    },
    ...renderHookOptions
  } = options;

  const result = renderHook(
    (props) => {
      renders.count++;

      const result = render(props);

      renders.frames.push(result);

      return result;
    },
    { ...renderHookOptions, wrapper }
  );

  return { ...result, renders };
}

function useSimpleQueryCase() {
  interface QueryData {
    greeting: string;
  }

  const query: TypedDocumentNode<QueryData> = gql`
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

  return { query, mocks };
}

function usePaginatedCase() {
  interface QueryData {
    letters: {
      name: string;
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

  const data = 'ABCDEFG'
    .split('')
    .map((letter, index) => ({ letter, position: index + 1 }));

  const link = new ApolloLink((operation) => {
    const { offset = 0, limit = 2 } = operation.variables;
    const letters = data.slice(offset, offset + limit);

    return Observable.of({ data: { letters } });
  });

  return { query, link, data };
}

interface ErrorCaseData {
  currentUser: {
    id: string;
    name: string | null;
  };
}

function useErrorCase<TData extends ErrorCaseData>(
  {
    data,
    networkError,
    graphQLErrors,
  }: {
    data?: TData;
    networkError?: Error;
    graphQLErrors?: GraphQLError[];
  } = Object.create(null)
) {
  const query: TypedDocumentNode<TData, never> = gql`
    query MyQuery {
      currentUser {
        id
        name
      }
    }
  `;

  const mock: MockedResponse<TData> = compact({
    request: { query },
    result: (data || graphQLErrors) && compact({ data, errors: graphQLErrors }),
    error: networkError,
  });

  return { query, mocks: [mock] };
}

function useVariablesQueryCase() {
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

  return { query, mocks };
}

function wait(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

describe('useSuspenseQuery', () => {
  it('validates the GraphQL query as a query', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const query = gql`
      mutation ShouldThrow {
        createException
      }
    `;

    expect(() => {
      renderHook(() => useSuspenseQuery(query), {
        wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
      });
    }).toThrowError(
      new InvariantError(
        'Running a Query requires a graphql Query, but a Mutation was used instead.'
      )
    );

    consoleSpy.mockRestore();
  });

  it('ensures a suspense cache is provided', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const { query } = useSimpleQueryCase();

    const client = new ApolloClient({ cache: new InMemoryCache() });

    expect(() => {
      renderHook(() => useSuspenseQuery(query), {
        wrapper: ({ children }) => (
          <ApolloProvider client={client} suspenseCache={undefined}>
            {children}
          </ApolloProvider>
        ),
      });
    }).toThrowError(
      new InvariantError(
        'Could not find a "suspenseCache" in the context. Wrap the root component ' +
          'in an <ApolloProvider> and provide a suspenseCache.'
      )
    );

    consoleSpy.mockRestore();
  });

  it('ensures a valid fetch policy is used', () => {
    const INVALID_FETCH_POLICIES = ['cache-only', 'standby'];
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const { query } = useSimpleQueryCase();

    INVALID_FETCH_POLICIES.forEach((fetchPolicy: any) => {
      expect(() => {
        renderHook(() => useSuspenseQuery(query, { fetchPolicy }), {
          wrapper: ({ children }) => (
            <MockedProvider>{children}</MockedProvider>
          ),
        });
      }).toThrowError(
        new InvariantError(
          `The fetch policy \`${fetchPolicy}\` is not supported with suspense.`
        )
      );
    });

    consoleSpy.mockRestore();
  });

  it('suspends a query and returns results', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { mocks }
    );

    // ensure the hook suspends immediately
    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it('suspends a query with variables and returns results', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: '1' } }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it('returns the same results for the same variables', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) => useSuspenseQuery(query, { variables: { id } }),
      { mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    const previousResult = result.current;

    rerender({ id: '1' });

    expect(result.current).toBe(previousResult);
    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it('ensures result is referentially stable', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender } = renderSuspenseHook(
      ({ id }) => useSuspenseQuery(query, { variables: { id } }),
      { mocks, initialProps: { id: '1' } }
    );

    expect(screen.getByText('loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    const previousResult = result.current;

    rerender({ id: '1' });

    expect(result.current).toBe(previousResult);
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

    const { result } = renderSuspenseHook(
      () => useSuspenseQuery(query, { canonizeResults: true }),
      { cache }
    );

    const { data } = result.current;
    const resultSet = new Set(data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(data).toEqual({ results });
    expect(data.results.length).toBe(6);
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

    const { result } = renderSuspenseHook(
      () => useSuspenseQuery(query, { canonizeResults: false }),
      { cache }
    );

    const { data } = result.current;
    const resultSet = new Set(data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(data).toEqual({ results });
    expect(data.results.length).toBe(6);
    expect(resultSet.size).toBe(6);
    expect(values).toEqual([0, 1, 1, 2, 3, 5]);
  });

  it('tears down the query on unmount', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const client = new ApolloClient({
      link: new ApolloLink(() => Observable.of(mocks[0].result)),
      cache: new InMemoryCache(),
    });

    const suspenseCache = new SuspenseCache();

    const { result, unmount } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { client, suspenseCache }
    );

    // We don't subscribe to the observable until after the component has been
    // unsuspended, so we need to wait for the result
    await waitFor(() =>
      expect(result.current.data).toEqual(mocks[0].result.data)
    );

    expect(client.getObservableQueries().size).toBe(1);
    expect(suspenseCache.lookup(query, undefined)).toBeDefined();

    unmount();

    expect(client.getObservableQueries().size).toBe(0);
    expect(suspenseCache.lookup(query, undefined)).toBeUndefined();
  });

  it('does not remove query from suspense cache if other queries are using it', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const client = new ApolloClient({
      link: new ApolloLink(() => Observable.of(mocks[0].result)),
      cache: new InMemoryCache(),
    });

    const suspenseCache = new SuspenseCache();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApolloProvider client={client} suspenseCache={suspenseCache}>
        <Suspense fallback="loading">{children}</Suspense>
      </ApolloProvider>
    );

    const { result: result1, unmount } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { wrapper }
    );

    const { result: result2 } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { wrapper }
    );

    // We don't subscribe to the observable until after the component has been
    // unsuspended, so we need to wait for the results of all queries
    await waitFor(() => {
      expect(result1.current.data).toEqual(mocks[0].result.data);
      expect(result2.current.data).toEqual(mocks[0].result.data);
    });

    // Because they are the same query, the 2 components use the same observable
    // in the suspense cache
    expect(client.getObservableQueries().size).toBe(1);
    expect(suspenseCache.lookup(query, undefined)).toBeDefined();

    unmount();

    expect(client.getObservableQueries().size).toBe(1);
    expect(suspenseCache.lookup(query, undefined)).toBeDefined();
  });

  it('allows the client to be overridden', async () => {
    const { query } = useSimpleQueryCase();

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

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { client: localClient }),
      { client: globalClient }
    );

    await waitFor(() =>
      expect(result.current.data).toEqual({ greeting: 'local hello' })
    );

    expect(renders.frames).toMatchObject([
      { data: { greeting: 'local hello' }, error: undefined },
    ]);
  });

  it('does not suspend when data is in the cache and using a "cache-first" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: { greeting: 'hello from cache' },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'cache-first' }),
      { cache, mocks }
    );

    expect(result.current).toMatchObject({
      data: { greeting: 'hello from cache' },
      error: undefined,
    });

    expect(renders.count).toBe(1);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      { data: { greeting: 'hello from cache' }, error: undefined },
    ]);
  });

  it('does not initiate a network request when data is in the cache and using a "cache-first" fetch policy', async () => {
    let fetchCount = 0;
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const link = new ApolloLink(() => {
      return new Observable((observer) => {
        fetchCount++;

        const mock = mocks[0];

        observer.next(mock.result);
        observer.complete();
      });
    });

    cache.writeQuery({
      query,
      data: { greeting: 'hello from cache' },
    });

    renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'cache-first' }),
      { cache, link, initialProps: { id: '1' } }
    );

    expect(fetchCount).toBe(0);
  });

  it('suspends when partial data is in the cache and using a "cache-first" fetch policy', async () => {
    const fullQuery = gql`
      query {
        character {
          id
          name
        }
      }
    `;

    const partialQuery = gql`
      query {
        character {
          id
        }
      }
    `;

    const mocks = [
      {
        request: { query: fullQuery },
        result: { data: { character: { id: '1', name: 'Doctor Strange' } } },
      },
    ];

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: '1' } },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(fullQuery, { fetchPolicy: 'cache-first' }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it('does not suspend when partial data is in the cache and using a "cache-first" fetch policy with returnPartialData', async () => {
    const fullQuery = gql`
      query {
        character {
          id
          name
        }
      }
    `;

    const partialQuery = gql`
      query {
        character {
          id
        }
      }
    `;

    const mocks = [
      {
        request: { query: fullQuery },
        result: { data: { character: { id: '1', name: 'Doctor Strange' } } },
      },
    ];

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: '1' } },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: 'cache-first',
          returnPartialData: true,
        }),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: { character: { id: '1' } },
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      { data: { character: { id: '1' } }, error: undefined },
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it('suspends and does not use partial data when changing variables and using a "cache-first" fetch policy with returnPartialData', async () => {
    const { query: fullQuery, mocks } = useVariablesQueryCase();

    const partialQuery = gql`
      query ($id: ID!) {
        character(id: $id) {
          id
        }
      }
    `;

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: '1' } },
      variables: { id: '1' },
    });

    const { result, renders, rerender } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: 'cache-first',
          returnPartialData: true,
          variables: { id },
        }),
      { cache, mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: { character: { id: '1' } },
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: { character: { id: '1' } }, error: undefined },
      { ...mocks[0].result, error: undefined },
      { ...mocks[0].result, error: undefined },
      { ...mocks[1].result, error: undefined },
    ]);
  });

  it('suspends when data is in the cache and using a "network-only" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: { greeting: 'hello from cache' },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'network-only' }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: { greeting: 'Hello' }, error: undefined },
    ]);
  });

  it('suspends when partial data is in the cache and using a "network-only" fetch policy with returnPartialData', async () => {
    const fullQuery = gql`
      query {
        character {
          id
          name
        }
      }
    `;

    const partialQuery = gql`
      query {
        character {
          id
        }
      }
    `;

    const mocks = [
      {
        request: { query: fullQuery },
        result: { data: { character: { id: '1', name: 'Doctor Strange' } } },
      },
    ];

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: '1' } },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: 'network-only',
          returnPartialData: true,
        }),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it('suspends and does not overwrite cache when data is in the cache and using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: { greeting: 'hello from cache' },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'no-cache' }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    const cachedData = cache.readQuery({ query });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: { greeting: 'Hello' }, error: undefined },
    ]);
    expect(cachedData).toEqual({ greeting: 'hello from cache' });
  });

  it('maintains results when rerendering a query using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, rerender, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'no-cache' }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: { greeting: 'Hello' }, error: undefined },
    ]);

    rerender();

    expect(result.current).toMatchObject({
      ...mocks[0].result,
      error: undefined,
    });
    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: { greeting: 'Hello' }, error: undefined },
      { data: { greeting: 'Hello' }, error: undefined },
    ]);
  });

  it('suspends when partial data is in the cache and using a "no-cache" fetch policy with returnPartialData', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const fullQuery = gql`
      query {
        character {
          id
          name
        }
      }
    `;

    const partialQuery = gql`
      query {
        character {
          id
        }
      }
    `;

    const mocks = [
      {
        request: { query: fullQuery },
        result: { data: { character: { id: '1', name: 'Doctor Strange' } } },
      },
    ];

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: '1' } },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: 'no-cache',
          returnPartialData: true,
        }),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
    ]);

    consoleSpy.mockRestore();
  });

  it('warns when using returnPartialData with a "no-cache" fetch policy', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { query, mocks } = useSimpleQueryCase();

    renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          fetchPolicy: 'no-cache',
          returnPartialData: true,
        }),
      { mocks }
    );

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      'Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy.'
    );

    consoleSpy.mockRestore();
  });

  it('does not suspend when data is in the cache and using a "cache-and-network" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: { greeting: 'hello from cache' },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'cache-and-network' }),
      { cache, mocks }
    );

    expect(result.current).toMatchObject({
      data: { greeting: 'hello from cache' },
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: 'hello from cache' },
        error: undefined,
      },
      { data: { greeting: 'Hello' }, error: undefined },
    ]);
  });

  it('does not suspend when partial data is in the cache and using a "cache-and-network" fetch policy with returnPartialData', async () => {
    const fullQuery = gql`
      query {
        character {
          id
          name
        }
      }
    `;

    const partialQuery = gql`
      query {
        character {
          id
        }
      }
    `;

    const mocks = [
      {
        request: { query: fullQuery },
        result: { data: { character: { id: '1', name: 'Doctor Strange' } } },
      },
    ];

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: '1' } },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: 'cache-and-network',
          returnPartialData: true,
        }),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: { character: { id: '1' } },
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      { data: { character: { id: '1' } }, error: undefined },
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it('suspends and does not use partial data when changing variables and using a "cache-and-network" fetch policy with returnPartialData', async () => {
    const { query: fullQuery, mocks } = useVariablesQueryCase();

    const partialQuery = gql`
      query ($id: ID!) {
        character(id: $id) {
          id
        }
      }
    `;

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: '1' } },
      variables: { id: '1' },
    });

    const { result, renders, rerender } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: 'cache-and-network',
          returnPartialData: true,
          variables: { id },
        }),
      { cache, mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: { character: { id: '1' } },
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: { character: { id: '1' } }, error: undefined },
      { ...mocks[0].result, error: undefined },
      { ...mocks[0].result, error: undefined },
      { ...mocks[1].result, error: undefined },
    ]);
  });

  it.each<SuspenseQueryHookFetchPolicy>([
    'cache-first',
    'network-only',
    'no-cache',
    'cache-and-network',
  ])(
    'returns previous data on refetch when changing variables and using a "%s" with an "initial" suspense policy',
    async (fetchPolicy) => {
      const { query, mocks } = useVariablesQueryCase();

      const { result, rerender, renders } = renderSuspenseHook(
        ({ id }) =>
          useSuspenseQuery(query, {
            fetchPolicy,
            suspensePolicy: 'initial',
            variables: { id },
          }),
        { mocks, initialProps: { id: '1' } }
      );

      expect(renders.suspenseCount).toBe(1);
      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[0].result,
          error: undefined,
        });
      });

      rerender({ id: '2' });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[1].result,
          error: undefined,
        });
      });

      // Renders:
      // 1. Initiate fetch and suspend
      // 2. Unsuspend and return results from initial fetch
      // 3. Change variables
      // 4. Unsuspend and return results from refetch
      expect(renders.count).toBe(4);
      expect(renders.suspenseCount).toBe(1);
      expect(renders.frames).toMatchObject([
        { ...mocks[0].result, error: undefined },
        { ...mocks[0].result, error: undefined },
        { ...mocks[1].result, error: undefined },
      ]);
    }
  );

  it.each<SuspenseQueryHookFetchPolicy>([
    'cache-first',
    'network-only',
    'cache-and-network',
  ])(
    'writes to the cache when using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useVariablesQueryCase();

      const cache = new InMemoryCache();

      const { result } = renderSuspenseHook(
        ({ id }) => useSuspenseQuery(query, { fetchPolicy, variables: { id } }),
        { cache, mocks, initialProps: { id: '1' } }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[0].result.data);
      });

      const cachedData = cache.readQuery({ query, variables: { id: '1' } });

      expect(cachedData).toEqual(mocks[0].result.data);
    }
  );

  it('does not write to the cache when using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const cache = new InMemoryCache();

    const { result } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, { fetchPolicy: 'no-cache', variables: { id } }),
      { cache, mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    const cachedData = cache.readQuery({ query, variables: { id: '1' } });

    expect(cachedData).toBeNull();
  });

  it.each<SuspenseQueryHookFetchPolicy>([
    'cache-first',
    'network-only',
    'cache-and-network',
  ])(
    'responds to cache updates when using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useSimpleQueryCase();

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const { result, renders } = renderSuspenseHook(
        () => useSuspenseQuery(query, { fetchPolicy }),
        { client }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[0].result.data);
      });

      client.writeQuery({
        query,
        data: { greeting: 'Updated hello' },
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          data: { greeting: 'Updated hello' },
          error: undefined,
        });
      });
      expect(renders.suspenseCount).toBe(1);
      expect(renders.count).toBe(3);
      expect(renders.frames).toMatchObject([
        { ...mocks[0].result, error: undefined },
        { data: { greeting: 'Updated hello' }, error: undefined },
      ]);
    }
  );

  it('does not respond to cache updates when using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'no-cache' }),
      { client }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    client.writeQuery({
      query,
      data: { greeting: 'Updated hello' },
    });

    // Wait for a while to ensure no updates happen asynchronously
    await wait(100);

    expect(result.current).toMatchObject({
      ...mocks[0].result,
      error: undefined,
    });
    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it.each<SuspenseQueryHookFetchPolicy>([
    'cache-first',
    'network-only',
    'no-cache',
    'cache-and-network',
  ])(
    're-suspends the component when changing variables and using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useVariablesQueryCase();

      const { result, rerender, renders } = renderSuspenseHook(
        ({ id }) => useSuspenseQuery(query, { fetchPolicy, variables: { id } }),
        { mocks, initialProps: { id: '1' } }
      );

      expect(renders.suspenseCount).toBe(1);
      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[0].result,
          error: undefined,
        });
      });

      rerender({ id: '2' });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[1].result,
          error: undefined,
        });
      });

      // Renders:
      // 1. Initiate fetch and suspend
      // 2. Unsuspend and return results from initial fetch
      // 3. Change variables
      // 4. Initiate refetch and suspend
      // 5. Unsuspend and return results from refetch
      expect(renders.count).toBe(5);
      expect(renders.suspenseCount).toBe(2);
      expect(renders.frames).toMatchObject([
        { ...mocks[0].result, error: undefined },
        { ...mocks[0].result, error: undefined },
        { ...mocks[1].result, error: undefined },
      ]);
    }
  );

  it.each<SuspenseQueryHookFetchPolicy>([
    'cache-first',
    'network-only',
    'no-cache',
    'cache-and-network',
  ])(
    're-suspends the component when changing queries and using a "%s" fetch policy',
    async (fetchPolicy) => {
      const query1: TypedDocumentNode<{ hello: string }> = gql`
        query Query1 {
          hello
        }
      `;

      const query2: TypedDocumentNode<{ world: string }> = gql`
        query Query2 {
          world
        }
      `;

      const mocks = [
        {
          request: { query: query1 },
          result: { data: { hello: 'query1' } },
        },
        {
          request: { query: query2 },
          result: { data: { world: 'query2' } },
        },
      ];

      const { result, rerender, renders } = renderSuspenseHook(
        ({ query }) => useSuspenseQuery(query, { fetchPolicy }),
        { mocks, initialProps: { query: query1 as DocumentNode } }
      );

      expect(renders.suspenseCount).toBe(1);
      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[0].result,
          error: undefined,
        });
      });

      rerender({ query: query2 });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[1].result,
          error: undefined,
        });
      });

      // Renders:
      // 1. Initiate fetch and suspend
      // 2. Unsuspend and return results from initial fetch
      // 3. Change queries
      // 4. Initiate refetch and suspend
      // 5. Unsuspend and return results from refetch
      expect(renders.count).toBe(5);
      expect(renders.suspenseCount).toBe(2);
      expect(renders.frames).toMatchObject([
        { ...mocks[0].result, error: undefined },
        { ...mocks[0].result, error: undefined },
        { ...mocks[1].result, error: undefined },
      ]);
    }
  );

  it.each<SuspenseQueryHookFetchPolicy>([
    'cache-first',
    'network-only',
    'no-cache',
    'cache-and-network',
  ])(
    'ensures data is fetched the correct amount of times when changing variables and using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useVariablesQueryCase();

      let fetchCount = 0;

      const link = new ApolloLink((operation) => {
        return new Observable((observer) => {
          fetchCount++;

          const mock = mocks.find(({ request }) =>
            equal(request.variables, operation.variables)
          );

          if (!mock) {
            throw new Error('Could not find mock for operation');
          }

          observer.next(mock.result);
          observer.complete();
        });
      });

      const { result, rerender } = renderSuspenseHook(
        ({ id }) => useSuspenseQuery(query, { fetchPolicy, variables: { id } }),
        { link, initialProps: { id: '1' } }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[0].result.data);
      });

      expect(fetchCount).toBe(1);

      rerender({ id: '2' });

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[1].result.data);
      });

      expect(fetchCount).toBe(2);
    }
  );

  it('uses the default fetch policy from the client when none provided in options', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const client = new ApolloClient({
      cache,
      link: new MockLink(mocks),
      defaultOptions: {
        watchQuery: {
          fetchPolicy: 'network-only',
        },
      },
    });

    client.writeQuery({ query, data: { greeting: 'hello from cache' } });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { client }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it('uses default variables from the client when none provided in options', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
      defaultOptions: {
        watchQuery: {
          variables: { id: '2' },
        },
      },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      { ...mocks[1].result, error: undefined },
    ]);
  });

  it('merges global default variables with local variables', async () => {
    const query = gql`
      query MergedVariablesQuery {
        vars
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink((operation) => {
        return new Observable((observer) => {
          observer.next({ data: { vars: operation.variables } });
          observer.complete();
        });
      }),
      defaultOptions: {
        watchQuery: {
          variables: { source: 'global', globalOnlyVar: true },
        },
      },
    });

    const { result, rerender, renders } = renderSuspenseHook(
      ({ source }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'network-only',
          variables: { source, localOnlyVar: true },
        }),
      { client, initialProps: { source: 'local' } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          vars: { source: 'local', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
      });
    });

    rerender({ source: 'rerender' });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          vars: { source: 'rerender', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        data: {
          vars: { source: 'local', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
      },
      {
        data: {
          vars: { source: 'local', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
      },
      {
        data: {
          vars: { source: 'rerender', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
      },
    ]);
  });

  it('can unset a globally defined variable', async () => {
    const query = gql`
      query MergedVariablesQuery {
        vars
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink((operation) => {
        return new Observable((observer) => {
          observer.next({ data: { vars: operation.variables } });
          observer.complete();
        });
      }),
      defaultOptions: {
        watchQuery: {
          variables: { source: 'global', globalOnlyVar: true },
        },
      },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          variables: { source: 'local', globalOnlyVar: undefined },
        }),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { vars: { source: 'local' } },
        error: undefined,
      });
    });

    // Check to make sure the property itself is not defined, not just set to
    // undefined. Unfortunately this is not caught by toMatchObject as
    // toMatchObject only checks a if the subset of options are equal, not if
    // they have strictly the same keys and values.
    expect(result.current.data.vars).not.toHaveProperty('globalOnlyVar');

    expect(renders.frames).toMatchObject([
      { data: { vars: { source: 'local' } }, error: undefined },
    ]);
  });

  it('passes context to the link', async () => {
    const query = gql`
      query ContextQuery {
        context
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink((operation) => {
        return new Observable((observer) => {
          const { valueA, valueB } = operation.getContext();

          observer.next({ data: { context: { valueA, valueB } } });
          observer.complete();
        });
      }),
    });

    const { result } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          context: { valueA: 'A', valueB: 'B' },
        }),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { context: { valueA: 'A', valueB: 'B' } },
        error: undefined,
      });
    });
  });

  it('throws network errors by default', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { query, mocks } = useErrorCase({
      networkError: new Error('Could not fetch'),
    });

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      mocks,
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toEqual(new Error('Could not fetch'));
    expect(error.graphQLErrors).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('throws graphql errors by default', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { query, mocks } = useErrorCase({
      graphQLErrors: [new GraphQLError('`id` should not be null')],
    });

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      mocks,
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toBeNull();
    expect(error.graphQLErrors).toEqual([
      new GraphQLError('`id` should not be null'),
    ]);

    consoleSpy.mockRestore();
  });

  it('tears down subscription when throwing an error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { query, mocks } = useErrorCase({
      networkError: new Error('Could not fetch'),
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      client,
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(client.getObservableQueries().size).toBe(0);

    consoleSpy.mockRestore();
  });

  it('tears down subscription when throwing an error on refetch', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          errors: [new GraphQLError('Something went wrong')],
        },
      },
    ];

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: '1' } }),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(client.getObservableQueries().size).toBe(0);

    consoleSpy.mockRestore();
  });

  it('tears down subscription when throwing an error on refetch when suspensePolicy is "initial"', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          errors: [new GraphQLError('Something went wrong')],
        },
      },
    ];

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          suspensePolicy: 'initial',
          variables: { id: '1' },
        }),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(client.getObservableQueries().size).toBe(0);

    consoleSpy.mockRestore();
  });

  it('throws network errors when errorPolicy is set to "none"', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { query, mocks } = useErrorCase({
      networkError: new Error('Could not fetch'),
    });

    const { renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'none' }),
      { mocks }
    );

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toEqual(new Error('Could not fetch'));
    expect(error.graphQLErrors).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('throws graphql errors when errorPolicy is set to "none"', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { query, mocks } = useErrorCase({
      graphQLErrors: [new GraphQLError('`id` should not be null')],
    });

    const { renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'none' }),
      { mocks }
    );

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toBeNull();
    expect(error.graphQLErrors).toEqual([
      new GraphQLError('`id` should not be null'),
    ]);

    consoleSpy.mockRestore();
  });

  it('handles multiple graphql errors when errorPolicy is set to "none"', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const graphQLErrors = [
      new GraphQLError('Fool me once'),
      new GraphQLError('Fool me twice'),
    ];

    const { query, mocks } = useErrorCase({ graphQLErrors });

    const { renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'none' }),
      { mocks }
    );

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error!.networkError).toBeNull();
    expect(error!.graphQLErrors).toEqual(graphQLErrors);

    consoleSpy.mockRestore();
  });

  it('does not throw or return network errors when errorPolicy is set to "ignore"', async () => {
    const { query, mocks } = useErrorCase({
      networkError: new Error('Could not fetch'),
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'ignore' }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: undefined,
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: undefined, error: undefined },
    ]);
  });

  it('does not throw or return graphql errors when errorPolicy is set to "ignore"', async () => {
    const { query, mocks } = useErrorCase({
      graphQLErrors: [new GraphQLError('`id` should not be null')],
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'ignore' }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: undefined,
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: undefined, error: undefined },
    ]);
  });

  it('returns partial data results and throws away errors when errorPolicy is set to "ignore"', async () => {
    const { query, mocks } = useErrorCase({
      data: { currentUser: { id: '1', name: null } },
      graphQLErrors: [new GraphQLError('`name` could not be found')],
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'ignore' }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { currentUser: { id: '1', name: null } },
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        data: { currentUser: { id: '1', name: null } },
        error: undefined,
      },
    ]);
  });

  it('throws away multiple graphql errors when errorPolicy is set to "ignore"', async () => {
    const { query, mocks } = useErrorCase({
      graphQLErrors: [
        new GraphQLError('Fool me once'),
        new GraphQLError('Fool me twice'),
      ],
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'ignore' }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      { data: undefined, error: undefined },
    ]);
  });

  it('does not throw and returns network errors when errorPolicy is set to "all"', async () => {
    const networkError = new Error('Could not fetch');

    const { query, mocks } = useErrorCase({ networkError });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'all' }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: new ApolloError({ networkError }),
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: undefined, error: new ApolloError({ networkError }) },
    ]);

    const { error } = result.current;

    expect(error).toBeInstanceOf(ApolloError);
    expect(error!.networkError).toEqual(networkError);
    expect(error!.graphQLErrors).toEqual([]);
  });

  it('does not throw and returns graphql errors when errorPolicy is set to "all"', async () => {
    const graphQLError = new GraphQLError('`id` should not be null');

    const { query, mocks } = useErrorCase({ graphQLErrors: [graphQLError] });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'all' }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: undefined,
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
      },
    ]);

    const { error } = result.current;

    expect(error).toBeInstanceOf(ApolloError);
    expect(error!.networkError).toBeNull();
    expect(error!.graphQLErrors).toEqual([graphQLError]);
  });

  it('handles multiple graphql errors when errorPolicy is set to "all"', async () => {
    const graphQLErrors = [
      new GraphQLError('Fool me once'),
      new GraphQLError('Fool me twice'),
    ];

    const { query, mocks } = useErrorCase({ graphQLErrors });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'all' }),
      { mocks }
    );

    const expectedError = new ApolloError({ graphQLErrors });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: expectedError,
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: undefined, error: expectedError },
    ]);

    const { error } = result.current;

    expect(error).toBeInstanceOf(ApolloError);
    expect(error!.networkError).toBeNull();
    expect(error!.graphQLErrors).toEqual(graphQLErrors);
  });

  it('returns partial data and keeps errors when errorPolicy is set to "all"', async () => {
    const graphQLError = new GraphQLError('`name` could not be found');

    const { query, mocks } = useErrorCase({
      data: { currentUser: { id: '1', name: null } },
      graphQLErrors: [graphQLError],
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'all' }),
      { mocks }
    );

    const expectedError = new ApolloError({ graphQLErrors: [graphQLError] });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { currentUser: { id: '1', name: null } },
        error: expectedError,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        data: { currentUser: { id: '1', name: null } },
        error: expectedError,
      },
    ]);
  });

  it('persists errors between rerenders when errorPolicy is set to "all"', async () => {
    const graphQLError = new GraphQLError('`name` could not be found');

    const { query, mocks } = useErrorCase({
      graphQLErrors: [graphQLError],
    });

    const { result, rerender } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'all' }),
      { mocks }
    );

    const expectedError = new ApolloError({ graphQLErrors: [graphQLError] });

    await waitFor(() => {
      expect(result.current.error).toEqual(expectedError);
    });

    rerender();

    expect(result.current.error).toEqual(expectedError);
  });

  it('clears errors when changing variables and errorPolicy is set to "all"', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const graphQLErrors = [new GraphQLError('Could not fetch user 1')];

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          errors: graphQLErrors,
        },
      },
      {
        request: { query, variables: { id: '2' } },
        result: {
          data: { user: { id: '2', name: 'Captain Marvel' } },
        },
      },
    ];

    const { result, renders, rerender } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, { errorPolicy: 'all', variables: { id } }),
      { mocks, initialProps: { id: '1' } }
    );

    const expectedError = new ApolloError({ graphQLErrors });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: expectedError,
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(5);
    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      { data: undefined, error: expectedError },
      { data: undefined, error: expectedError },
      { ...mocks[1].result, error: undefined },
    ]);
  });

  it('clears errors when changing variables and errorPolicy is set to "all" with an "initial" suspensePolicy', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const graphQLErrors = [new GraphQLError('Could not fetch user 1')];

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          errors: graphQLErrors,
        },
      },
      {
        request: { query, variables: { id: '2' } },
        result: {
          data: { user: { id: '2', name: 'Captain Marvel' } },
        },
      },
    ];

    const { result, renders, rerender } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          errorPolicy: 'all',
          suspensePolicy: 'initial',
          variables: { id },
        }),
      { mocks, initialProps: { id: '1' } }
    );

    const expectedError = new ApolloError({ graphQLErrors });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: expectedError,
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: undefined, error: expectedError },
      { data: undefined, error: expectedError },
      { ...mocks[1].result, error: undefined },
    ]);
  });

  it('re-suspends when calling `refetch`', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel (updated)' } },
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: '1' } }),
      { mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
      { ...mocks[1].result, error: undefined },
    ]);
  });

  it('re-suspends when calling `refetch` with new variables', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '2' } },
        result: {
          data: { user: { id: '2', name: 'Captain America' } },
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: '1' } }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch({ id: '2' });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });
    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
      { ...mocks[1].result, error: undefined },
    ]);
  });

  it('re-suspends multiple times when calling `refetch` multiple times', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel (updated)' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel (updated again)' } },
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: '1' } }),
      { mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[2].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(6);
    expect(renders.suspenseCount).toBe(3);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
      { ...mocks[1].result, error: undefined },
      { ...mocks[2].result, error: undefined },
    ]);
  });

  it('does not suspend and returns previous data when calling `refetch` and using an "initial" suspensePolicy', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel (updated)' } },
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          suspensePolicy: 'initial',
          variables: { id: '1' },
        }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
      { ...mocks[1].result, error: undefined },
    ]);
  });

  it('throws errors when errors are returned after calling `refetch`', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          errors: [new GraphQLError('Something went wrong')],
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: '1' } }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(renders.errorCount).toBe(1);
    });

    expect(renders.errors).toEqual([
      new ApolloError({
        graphQLErrors: [new GraphQLError('Something went wrong')],
      }),
    ]);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
    ]);

    consoleSpy.mockRestore();
  });

  it('ignores errors returned after calling `refetch` when errorPolicy is set to "ignore"', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          errors: [new GraphQLError('Something went wrong')],
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          errorPolicy: 'ignore',
          variables: { id: '1' },
        }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
      { ...mocks[0].result, error: undefined },
    ]);
  });

  it('returns errors after calling `refetch` when errorPolicy is set to "all"', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          errors: [new GraphQLError('Something went wrong')],
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          errorPolicy: 'all',
          variables: { id: '1' },
        }),
      { mocks }
    );

    const expectedError = new ApolloError({
      graphQLErrors: [new GraphQLError('Something went wrong')],
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: expectedError,
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
      { ...mocks[0].result, error: expectedError },
    ]);
  });

  it('handles partial data results after calling `refetch` when errorPolicy is set to "all"', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: null } },
          errors: [new GraphQLError('Something went wrong')],
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          errorPolicy: 'all',
          variables: { id: '1' },
        }),
      { mocks }
    );

    const expectedError = new ApolloError({
      graphQLErrors: [new GraphQLError('Something went wrong')],
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: mocks[1].result.data,
        error: expectedError,
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.frames).toMatchObject([
      { ...mocks[0].result, error: undefined },
      { data: mocks[1].result.data, error: expectedError },
    ]);
  });

  it('re-suspends when calling `fetchMore` with different variables', async () => {
    const { data, query, link } = usePaginatedCase();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { limit: 2 } }),
      { link }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 2) },
        error: undefined,
      });
    });

    act(() => {
      result.current.fetchMore({ variables: { offset: 2 } });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(2, 4) },
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      { data: { letters: data.slice(0, 2) }, error: undefined },
      { data: { letters: data.slice(2, 4) }, error: undefined },
    ]);
  });

  it('does not re-suspend when calling `fetchMore` with different variables while using an "initial" suspense policy', async () => {
    const { data, query, link } = usePaginatedCase();

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          suspensePolicy: 'initial',
          variables: { limit: 2 },
        }),
      { link }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 2) },
        error: undefined,
      });
    });

    act(() => {
      result.current.fetchMore({ variables: { offset: 2 } });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(2, 4) },
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: { letters: data.slice(0, 2) }, error: undefined },
      { data: { letters: data.slice(2, 4) }, error: undefined },
    ]);
  });

  it('properly uses `updateQuery` when calling `fetchMore`', async () => {
    const { data, query, link } = usePaginatedCase();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { limit: 2 } }),
      { link }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 2) },
        error: undefined,
      });
    });

    act(() => {
      result.current.fetchMore({
        variables: { offset: 2 },
        updateQuery: (prev, { fetchMoreResult }) => ({
          letters: prev.letters.concat(fetchMoreResult.letters),
        }),
      });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 4) },
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      { data: { letters: data.slice(0, 2) }, error: undefined },
      { data: { letters: data.slice(0, 4) }, error: undefined },
    ]);
  });

  it('properly uses cache field policies when calling `fetchMore` without `updateQuery`', async () => {
    const { data, query, link } = usePaginatedCase();

    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: concatPagination(),
          },
        },
      },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { limit: 2 } }),
      { cache, link }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 2) },
        error: undefined,
      });
    });

    act(() => {
      result.current.fetchMore({ variables: { offset: 2 } });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 4) },
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      { data: { letters: data.slice(0, 2) }, error: undefined },
      { data: { letters: data.slice(0, 4) }, error: undefined },
    ]);
  });

  it('applies nextFetchPolicy after initial suspense', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const cache = new InMemoryCache();

    // network-only should bypass this cached result and suspend the component
    cache.writeQuery({
      query,
      data: { character: { id: '1', name: 'Cached Hulk' } },
      variables: { id: '1' },
    });

    // cache-first should read from this result on the rerender
    cache.writeQuery({
      query,
      data: { character: { id: '2', name: 'Cached Black Widow' } },
      variables: { id: '2' },
    });

    const { result, renders, rerender } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'network-only',
          // There is no way to trigger a followup query using nextFetchPolicy
          // when this is a string vs a function. When changing variables,
          // the `fetchPolicy` is reset back to `initialFetchPolicy` before the
          // request is sent, negating the `nextFetchPolicy`. Using `refetch` or
          // `fetchMore` sets the `fetchPolicy` to `network-only`, which negates
          // the value. Using a function seems to be the only way to force a
          // `nextFetchPolicy` without resorting to lower-level methods
          // (i.e. `observable.reobserve`)
          nextFetchPolicy: () => 'cache-first',
          variables: { id },
        }),
      { cache, mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { character: { id: '2', name: 'Cached Black Widow' } },
        error: undefined,
      });
    });

    expect(renders.suspenseCount).toBe(1);
  });

  it('honors refetchWritePolicy set to "overwrite"', async () => {
    const query: TypedDocumentNode<
      { primes: number[] },
      { min: number; max: number }
    > = gql`
      query GetPrimes($min: number, $max: number) {
        primes(min: $min, max: $max)
      }
    `;

    const mocks = [
      {
        request: { query, variables: { min: 0, max: 12 } },
        result: { data: { primes: [2, 3, 5, 7, 11] } },
      },
      {
        request: { query, variables: { min: 12, max: 30 } },
        result: { data: { primes: [13, 17, 19, 23, 29] } },
        delay: 10,
      },
    ];

    const mergeParams: [number[] | undefined, number[]][] = [];
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            primes: {
              keyArgs: false,
              merge(existing: number[] | undefined, incoming: number[]) {
                mergeParams.push([existing, incoming]);
                return existing ? existing.concat(incoming) : incoming;
              },
            },
          },
        },
      },
    });

    const { result } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          variables: { min: 0, max: 12 },
          refetchWritePolicy: 'overwrite',
        }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

    act(() => {
      result.current.refetch({ min: 12, max: 30 });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [undefined, [13, 17, 19, 23, 29]],
    ]);
  });

  it('honors refetchWritePolicy set to "merge"', async () => {
    const query: TypedDocumentNode<
      { primes: number[] },
      { min: number; max: number }
    > = gql`
      query GetPrimes($min: number, $max: number) {
        primes(min: $min, max: $max)
      }
    `;

    const mocks = [
      {
        request: { query, variables: { min: 0, max: 12 } },
        result: { data: { primes: [2, 3, 5, 7, 11] } },
      },
      {
        request: { query, variables: { min: 12, max: 30 } },
        result: { data: { primes: [13, 17, 19, 23, 29] } },
        delay: 10,
      },
    ];

    const mergeParams: [number[] | undefined, number[]][] = [];
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            primes: {
              keyArgs: false,
              merge(existing: number[] | undefined, incoming: number[]) {
                mergeParams.push([existing, incoming]);
                return existing ? existing.concat(incoming) : incoming;
              },
            },
          },
        },
      },
    });

    const { result } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          variables: { min: 0, max: 12 },
          refetchWritePolicy: 'merge',
        }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

    act(() => {
      result.current.refetch({ min: 12, max: 30 });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [
        [2, 3, 5, 7, 11],
        [13, 17, 19, 23, 29],
      ],
    ]);
  });

  it('defaults refetchWritePolicy to "overwrite"', async () => {
    const query: TypedDocumentNode<
      { primes: number[] },
      { min: number; max: number }
    > = gql`
      query GetPrimes($min: number, $max: number) {
        primes(min: $min, max: $max)
      }
    `;

    const mocks = [
      {
        request: { query, variables: { min: 0, max: 12 } },
        result: { data: { primes: [2, 3, 5, 7, 11] } },
      },
      {
        request: { query, variables: { min: 12, max: 30 } },
        result: { data: { primes: [13, 17, 19, 23, 29] } },
        delay: 10,
      },
    ];

    const mergeParams: [number[] | undefined, number[]][] = [];
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            primes: {
              keyArgs: false,
              merge(existing: number[] | undefined, incoming: number[]) {
                mergeParams.push([existing, incoming]);
                return existing ? existing.concat(incoming) : incoming;
              },
            },
          },
        },
      },
    });

    const { result } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { min: 0, max: 12 } }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

    act(() => {
      result.current.refetch({ min: 12, max: 30 });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [undefined, [13, 17, 19, 23, 29]],
    ]);
  });

  it('does not oversubscribe when suspending multiple times', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel (updated)' } },
        },
      },
      {
        request: { query, variables: { id: '1' } },
        result: {
          data: { user: { id: '1', name: 'Captain Marvel (updated again)' } },
        },
      },
    ];

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { result } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: '1' } }),
      { client, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[2].result,
        error: undefined,
      });
    });

    expect(client.getObservableQueries().size).toBe(1);
  });

  it('suspends deferred queries until initial chunk loads then streams in data as it loads', async () => {
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

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { link }
    );

    expect(renders.suspenseCount).toBe(1);

    link.simulateResult({
      result: {
        data: { greeting: { message: 'Hello world', __typename: 'Greeting' } },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: { message: 'Hello world', __typename: 'Greeting' } },
        error: undefined,
      });
    });

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
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Alice' },
          },
        },
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: { message: 'Hello world', __typename: 'Greeting' } },
        error: undefined,
      },
      {
        data: {
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Alice' },
          },
        },
        error: undefined,
      },
    ]);
  });

  it.each<SuspenseQueryHookFetchPolicy>([
    'cache-first',
    'network-only',
    'no-cache',
    'cache-and-network',
  ])(
    'suspends deferred queries until initial chunk loads then streams in data as it loads when using a "%s" fetch policy',
    async (fetchPolicy) => {
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

      const link = new MockSubscriptionLink();

      const { result, renders } = renderSuspenseHook(
        () => useSuspenseQuery(query, { fetchPolicy }),
        { link }
      );

      expect(renders.suspenseCount).toBe(1);

      link.simulateResult({
        result: {
          data: {
            greeting: { message: 'Hello world', __typename: 'Greeting' },
          },
          hasNext: true,
        },
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          data: {
            greeting: { message: 'Hello world', __typename: 'Greeting' },
          },
          error: undefined,
        });
      });

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
        expect(result.current).toMatchObject({
          data: {
            greeting: {
              __typename: 'Greeting',
              message: 'Hello world',
              recipient: { __typename: 'Person', name: 'Alice' },
            },
          },
          error: undefined,
        });
      });

      expect(renders.count).toBe(3);
      expect(renders.suspenseCount).toBe(1);
      expect(renders.frames).toMatchObject([
        {
          data: {
            greeting: { message: 'Hello world', __typename: 'Greeting' },
          },
          error: undefined,
        },
        {
          data: {
            greeting: {
              __typename: 'Greeting',
              message: 'Hello world',
              recipient: { __typename: 'Person', name: 'Alice' },
            },
          },
          error: undefined,
        },
      ]);
    }
  );

  it('does not suspend deferred queries with data in the cache and using a "cache-first" fetch policy', async () => {
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

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: 'Greeting',
          message: 'Hello world',
          recipient: { __typename: 'Person', name: 'Alice' },
        },
      },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'cache-first' }),
      { cache }
    );

    expect(result.current).toMatchObject({
      data: {
        greeting: {
          message: 'Hello world',
          __typename: 'Greeting',
          recipient: { __typename: 'Person', name: 'Alice' },
        },
      },
      error: undefined,
    });

    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      {
        data: {
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Alice' },
          },
        },
        error: undefined,
      },
    ]);
  });

  // TODO: Determine if this is the correct behavior or not
  it.skip('does not suspend deferred queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
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

    const link = new MockSubscriptionLink();
    const cache = new InMemoryCache();
    const client = new ApolloClient({ cache, link });

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

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'cache-and-network' }),
      { client }
    );

    expect(result.current).toMatchObject({
      data: {
        greeting: {
          message: 'Hello cached',
          __typename: 'Greeting',
          recipient: { __typename: 'Person', name: 'Cached Alice' },
        },
      },
      error: undefined,
    });

    link.simulateResult({
      result: {
        data: { greeting: { __typename: 'Greeting', message: 'Hello world' } },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Cached Alice' },
          },
        },
        error: undefined,
      });
    });

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
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Alice' },
          },
        },
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      {
        data: {
          greeting: {
            __typename: 'Greeting',
            message: 'Hello cached',
            recipient: { __typename: 'Person', name: 'Cached Alice' },
          },
        },
        error: undefined,
      },
      {
        data: {
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Cached Alice' },
          },
        },
        error: undefined,
      },
      {
        data: {
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Alice' },
          },
        },
        error: undefined,
      },
    ]);
  });

  it('suspends deferred queries with lists and properly patches results', async () => {
    const query = gql`
      query {
        greetings {
          message
          ... on Greeting @defer {
            recipient {
              name
            }
          }
        }
      }
    `;

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { link }
    );

    expect(renders.suspenseCount).toBe(1);

    link.simulateResult({
      result: {
        data: {
          greetings: [
            { __typename: 'Greeting', message: 'Hello world' },
            { __typename: 'Greeting', message: 'Hello again' },
          ],
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greetings: [
            { __typename: 'Greeting', message: 'Hello world' },
            { __typename: 'Greeting', message: 'Hello again' },
          ],
        },
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            data: {
              __typename: 'Greeting',
              recipient: { __typename: 'Person', name: 'Alice' },
            },
            path: ['greetings', 0],
          },
        ],
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greetings: [
            {
              __typename: 'Greeting',
              message: 'Hello world',
              recipient: { __typename: 'Person', name: 'Alice' },
            },
            {
              __typename: 'Greeting',
              message: 'Hello again',
            },
          ],
        },
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            data: {
              __typename: 'Greeting',
              recipient: { __typename: 'Person', name: 'Bob' },
            },
            path: ['greetings', 1],
          },
        ],
        hasNext: false,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greetings: [
            {
              __typename: 'Greeting',
              message: 'Hello world',
              recipient: { __typename: 'Person', name: 'Alice' },
            },
            {
              __typename: 'Greeting',
              message: 'Hello again',
              recipient: { __typename: 'Person', name: 'Bob' },
            },
          ],
        },
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: {
          greetings: [
            { __typename: 'Greeting', message: 'Hello world' },
            { __typename: 'Greeting', message: 'Hello again' },
          ],
        },
        error: undefined,
      },
      {
        data: {
          greetings: [
            {
              __typename: 'Greeting',
              message: 'Hello world',
              recipient: { __typename: 'Person', name: 'Alice' },
            },
            {
              __typename: 'Greeting',
              message: 'Hello again',
            },
          ],
        },
        error: undefined,
      },
      {
        data: {
          greetings: [
            {
              __typename: 'Greeting',
              message: 'Hello world',
              recipient: { __typename: 'Person', name: 'Alice' },
            },
            {
              __typename: 'Greeting',
              message: 'Hello again',
              recipient: { __typename: 'Person', name: 'Bob' },
            },
          ],
        },
        error: undefined,
      },
    ]);
  });

  it('suspends queries with deferred fragments in lists and properly merges arrays', async () => {
    const query = gql`
      query DeferVariation {
        allProducts {
          delivery {
            ...MyFragment @defer
          }
          sku
          id
        }
      }

      fragment MyFragment on DeliveryEstimates {
        estimatedDelivery
        fastestDelivery
      }
    `;

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { link }
    );

    expect(renders.suspenseCount).toBe(1);

    link.simulateResult({
      result: {
        data: {
          allProducts: [
            {
              __typename: 'Product',
              delivery: {
                __typename: 'DeliveryEstimates',
              },
              id: 'apollo-federation',
              sku: 'federation',
            },
            {
              __typename: 'Product',
              delivery: {
                __typename: 'DeliveryEstimates',
              },
              id: 'apollo-studio',
              sku: 'studio',
            },
          ],
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          allProducts: [
            {
              __typename: 'Product',
              delivery: {
                __typename: 'DeliveryEstimates',
              },
              id: 'apollo-federation',
              sku: 'federation',
            },
            {
              __typename: 'Product',
              delivery: {
                __typename: 'DeliveryEstimates',
              },
              id: 'apollo-studio',
              sku: 'studio',
            },
          ],
        },
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        hasNext: true,
        incremental: [
          {
            data: {
              __typename: 'DeliveryEstimates',
              estimatedDelivery: '6/25/2021',
              fastestDelivery: '6/24/2021',
            },
            path: ['allProducts', 0, 'delivery'],
          },
          {
            data: {
              __typename: 'DeliveryEstimates',
              estimatedDelivery: '6/25/2021',
              fastestDelivery: '6/24/2021',
            },
            path: ['allProducts', 1, 'delivery'],
          },
        ],
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          allProducts: [
            {
              __typename: 'Product',
              delivery: {
                __typename: 'DeliveryEstimates',
                estimatedDelivery: '6/25/2021',
                fastestDelivery: '6/24/2021',
              },
              id: 'apollo-federation',
              sku: 'federation',
            },
            {
              __typename: 'Product',
              delivery: {
                __typename: 'DeliveryEstimates',
                estimatedDelivery: '6/25/2021',
                fastestDelivery: '6/24/2021',
              },
              id: 'apollo-studio',
              sku: 'studio',
            },
          ],
        },
        error: undefined,
      });
    });
  });

  it('throws network errors returned by deferred queries', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

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

    const link = new MockSubscriptionLink();

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      link,
    });

    link.simulateResult({
      error: new Error('Could not fetch'),
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toEqual(new Error('Could not fetch'));
    expect(error.graphQLErrors).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('throws graphql errors returned by deferred queries', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

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

    const link = new MockSubscriptionLink();

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      link,
    });

    link.simulateResult({
      result: {
        errors: [new GraphQLError('Could not fetch greeting')],
      },
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toBeNull();
    expect(error.graphQLErrors).toEqual([
      new GraphQLError('Could not fetch greeting'),
    ]);

    consoleSpy.mockRestore();
  });

  it('throws errors returned by deferred queries that include partial data', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

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

    const link = new MockSubscriptionLink();

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      link,
    });

    link.simulateResult({
      result: {
        data: { greeting: null },
        errors: [new GraphQLError('Could not fetch greeting')],
      },
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toBeNull();
    expect(error.graphQLErrors).toEqual([
      new GraphQLError('Could not fetch greeting'),
    ]);

    consoleSpy.mockRestore();
  });

  it('discards partial data and does not throw errors returned in incremental chunks but returns them in `error` property', async () => {
    const query = gql`
      query {
        hero {
          name
          heroFriends {
            id
            name
            ... @defer {
              homeWorld
            }
          }
        }
      }
    `;

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { link }
    );

    link.simulateResult({
      result: {
        data: {
          hero: {
            name: 'R2-D2',
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
          },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            path: ['hero', 'heroFriends', 0],
            errors: [
              new GraphQLError(
                'homeWorld for character with ID 1000 could not be fetched.',
                { path: ['hero', 'heroFriends', 0, 'homeWorld'] }
              ),
            ],
            data: {
              homeWorld: null,
            },
          },
          // This chunk is ignored since errorPolicy `none` throws away partial
          // data
          {
            path: ['hero', 'heroFriends', 1],
            data: {
              homeWorld: 'Alderaan',
            },
          },
        ],
        hasNext: false,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: new ApolloError({
          graphQLErrors: [
            new GraphQLError(
              'homeWorld for character with ID 1000 could not be fetched.',
              { path: ['hero', 'heroFriends', 0, 'homeWorld'] }
            ),
          ],
        }),
      });
    });

    expect(result.current.error).toBeInstanceOf(ApolloError);

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: undefined,
      },
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: new ApolloError({
          graphQLErrors: [
            new GraphQLError(
              'homeWorld for character with ID 1000 could not be fetched.',
              { path: ['hero', 'heroFriends', 0, 'homeWorld'] }
            ),
          ],
        }),
      },
    ]);
  });

  it('adds partial data and does not throw errors returned in incremental chunks but returns them in `error` property with errorPolicy set to `all`', async () => {
    const query = gql`
      query {
        hero {
          name
          heroFriends {
            id
            name
            ... @defer {
              homeWorld
            }
          }
        }
      }
    `;

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'all' }),
      { link }
    );

    link.simulateResult({
      result: {
        data: {
          hero: {
            name: 'R2-D2',
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
          },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            path: ['hero', 'heroFriends', 0],
            errors: [
              new GraphQLError(
                'homeWorld for character with ID 1000 could not be fetched.',
                { path: ['hero', 'heroFriends', 0, 'homeWorld'] }
              ),
            ],
            data: {
              homeWorld: null,
            },
          },
          // Unlike the default (errorPolicy = `none`), this data will be
          // added to the final result
          {
            path: ['hero', 'heroFriends', 1],
            data: {
              homeWorld: 'Alderaan',
            },
          },
        ],
        hasNext: false,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
                homeWorld: null,
              },
              {
                id: '1003',
                name: 'Leia Organa',
                homeWorld: 'Alderaan',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: new ApolloError({
          graphQLErrors: [
            new GraphQLError(
              'homeWorld for character with ID 1000 could not be fetched.',
              { path: ['hero', 'heroFriends', 0, 'homeWorld'] }
            ),
          ],
        }),
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: undefined,
      },
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
                homeWorld: null,
              },
              {
                id: '1003',
                name: 'Leia Organa',
                homeWorld: 'Alderaan',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: new ApolloError({
          graphQLErrors: [
            new GraphQLError(
              'homeWorld for character with ID 1000 could not be fetched.',
              { path: ['hero', 'heroFriends', 0, 'homeWorld'] }
            ),
          ],
        }),
      },
    ]);
  });

  it('adds partial data and discards errors returned in incremental chunks with errorPolicy set to `ignore`', async () => {
    const query = gql`
      query {
        hero {
          name
          heroFriends {
            id
            name
            ... @defer {
              homeWorld
            }
          }
        }
      }
    `;

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: 'ignore' }),
      { link }
    );

    link.simulateResult({
      result: {
        data: {
          hero: {
            name: 'R2-D2',
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
          },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            path: ['hero', 'heroFriends', 0],
            errors: [
              new GraphQLError(
                'homeWorld for character with ID 1000 could not be fetched.',
                { path: ['hero', 'heroFriends', 0, 'homeWorld'] }
              ),
            ],
            data: {
              homeWorld: null,
            },
          },
          {
            path: ['hero', 'heroFriends', 1],
            data: {
              homeWorld: 'Alderaan',
            },
          },
        ],
        hasNext: false,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
                homeWorld: null,
              },
              {
                id: '1003',
                name: 'Leia Organa',
                homeWorld: 'Alderaan',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
              },
              {
                id: '1003',
                name: 'Leia Organa',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: undefined,
      },
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker',
                homeWorld: null,
              },
              {
                id: '1003',
                name: 'Leia Organa',
                homeWorld: 'Alderaan',
              },
            ],
            name: 'R2-D2',
          },
        },
        error: undefined,
      },
    ]);
  });
});
