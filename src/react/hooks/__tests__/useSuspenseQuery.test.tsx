import React, { Suspense } from 'react';
import {
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
import { compact } from '../../../utilities';
import { MockedProvider, MockedResponse, MockLink } from '../../../testing';
import { ApolloProvider } from '../../context';
import { SuspenseCache } from '../../cache';
import { useSuspenseQuery_experimental as useSuspenseQuery } from '../useSuspenseQuery';

type RenderSuspenseHookOptions<
  Props,
  TSerializedCache = {}
> = RenderHookOptions<Props> & {
  client?: ApolloClient<TSerializedCache>;
  link?: ApolloLink;
  cache?: ApolloCache<TSerializedCache>;
  mocks?: MockedResponse[];
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

  const errorBoundaryProps: ErrorBoundaryProps = {
    fallback: <div>Error</div>,
    onError: (error) => {
      renders.errorCount++;
      renders.errors.push(error);
    },
  };

  const {
    cache,
    client,
    link,
    mocks = [],
    wrapper = ({ children }) => {
      return client ? (
        <ApolloProvider client={client} suspenseCache={new SuspenseCache()}>
          <ErrorBoundary {...errorBoundaryProps}>
            <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>
          </ErrorBoundary>
        </ApolloProvider>
      ) : (
        <MockedProvider cache={cache} mocks={mocks} link={link}>
          <ErrorBoundary {...errorBoundaryProps}>
            <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>
          </ErrorBoundary>
        </MockedProvider>
      );
    },
    ...renderHookOptions
  } = options;

  const renders: Renders<Result> = {
    errors: [],
    errorCount: 0,
    suspenseCount: 0,
    count: 0,
    frames: [],
  };

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
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: {},
      });
    });

    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
    ]);
  });

  it('suspends a query with variables and returns results', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: '1' } }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
    ]);
  });

  it('returns the same results for the same variables', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) => useSuspenseQuery(query, { variables: { id } }),
      { mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    rerender({ id: '1' });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
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
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
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
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client} suspenseCache={suspenseCache}>
            <Suspense fallback="loading">{children}</Suspense>
          </ApolloProvider>
        ),
      }
    );

    // We don't subscribe to the observable until after the component has been
    // unsuspended, so we need to wait for the result
    await waitFor(() =>
      expect(result.current.data).toEqual(mocks[0].result.data)
    );

    expect(client.getObservableQueries().size).toBe(1);
    expect(suspenseCache.getQuery(query)).toBeDefined();

    unmount();

    expect(client.getObservableQueries().size).toBe(0);
    expect(suspenseCache.getQuery(query)).toBeUndefined();
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
    expect(suspenseCache.getQuery(query)).toBeDefined();

    unmount();

    expect(client.getObservableQueries().size).toBe(1);
    expect(suspenseCache.getQuery(query)).toBeDefined();
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

    expect(renders.frames).toEqual([
      { data: { greeting: 'local hello' }, error: undefined, variables: {} },
    ]);
  });

  it('re-suspends the component when changing variables and using a "cache-first" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'cache-first',
          variables: { id },
        }),
      { mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change variables
    // 4. Initiate refetch and suspend
    // 5. Unsuspend and return results from refetch
    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
    ]);
  });

  it('returns previous data on refetch when changing variables and using a "cache-first" with an "initial" suspense policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'cache-first',
          suspensePolicy: 'initial',
          variables: { id },
        }),
      { mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change variables
    // 4. Unsuspend and return results from refetch
    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
    ]);
  });

  it('re-suspends the component when changing queries and using a "cache-first" fetch policy', async () => {
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
      ({ query }) => useSuspenseQuery(query, { fetchPolicy: 'cache-first' }),
      { mocks, initialProps: { query: query1 as DocumentNode } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: {},
      });
    });

    rerender({ query: query2 });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: {},
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change queries
    // 4. Initiate refetch and suspend
    // 5. Unsuspend and return results from refetch
    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
      { ...mocks[0].result, error: undefined, variables: {} },
      { ...mocks[1].result, error: undefined, variables: {} },
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

    expect(result.current).toEqual({
      data: { greeting: 'hello from cache' },
      error: undefined,
      variables: {},
    });

    expect(renders.count).toBe(1);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toEqual([
      {
        data: { greeting: 'hello from cache' },
        error: undefined,
        variables: {},
      },
    ]);
  });

  it('ensures data is fetched is the correct amount of times when using a "cache-first" fetch policy', async () => {
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

        observer.next(mock.result!);
        observer.complete();
      });
    });

    const { result, rerender } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'cache-first',
          variables: { id },
        }),
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
  });

  it('writes to the cache when using a "cache-first" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const cache = new InMemoryCache();

    const { result } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'cache-first',
          variables: { id },
        }),
      { cache, mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    const cachedData = cache.readQuery({ query, variables: { id: '1' } });

    expect(cachedData).toEqual(mocks[0].result.data);
  });

  it('responds to cache updates when using a "cache-first" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'cache-first' }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    cache.writeQuery({
      query,
      data: { greeting: 'Updated hello' },
    });

    await wait(20);

    expect(result.current).toEqual({
      data: { greeting: 'Updated hello' },
      error: undefined,
      variables: {},
    });
    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(3);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
      { data: { greeting: 'Updated hello' }, error: undefined, variables: {} },
    ]);
  });

  it('re-suspends the component when changing variables and using a "network-only" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'network-only',
          variables: { id },
        }),
      { mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change variables
    // 4. Initiate refetch and suspend
    // 5. Unsuspend and return results from refetch
    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
    ]);
  });

  it('returns previous data on refetch when changing variables and using a "network-only" with an "initial" suspense policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'network-only',
          suspensePolicy: 'initial',
          variables: { id },
        }),
      { mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change variables
    // 4. Unsuspend and return results from refetch
    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
    ]);
  });

  it('re-suspends the component when changing queries and using a "network-only" fetch policy', async () => {
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
      ({ query }) => useSuspenseQuery(query, { fetchPolicy: 'network-only' }),
      { mocks, initialProps: { query: query1 as DocumentNode } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: {},
      });
    });

    rerender({ query: query2 });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: {},
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change queries
    // 4. Initiate refetch and suspend
    // 5. Unsuspend and return results from refetch
    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
      { ...mocks[0].result, error: undefined, variables: {} },
      { ...mocks[1].result, error: undefined, variables: {} },
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
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: {},
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: { greeting: 'Hello' }, error: undefined, variables: {} },
    ]);
  });

  it('ensures data is fetched is the correct amount of times when using a "network-only" fetch policy', async () => {
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
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'network-only',
          variables: { id },
        }),
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
  });

  it('writes to the cache when using a "network-only" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const cache = new InMemoryCache();

    const { result } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'network-only',
          variables: { id },
        }),
      { cache, mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    const cachedData = cache.readQuery({ query, variables: { id: '1' } });

    expect(cachedData).toEqual(mocks[0].result.data);
  });

  it('responds to cache updates when using a "network-only" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'network-only' }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    cache.writeQuery({
      query,
      data: { greeting: 'Updated hello' },
    });

    await wait(10);

    expect(result.current).toEqual({
      data: { greeting: 'Updated hello' },
      error: undefined,
      variables: {},
    });
    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(3);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
      { data: { greeting: 'Updated hello' }, error: undefined, variables: {} },
    ]);
  });

  it('re-suspends the component when changing variables and using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'no-cache',
          variables: { id },
        }),
      { mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change variables
    // 4. Initiate refetch and suspend
    // 5. Unsuspend and return results from refetch
    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
    ]);
  });

  it('returns previous data on refetch when changing variables and using a "no-cache" with an "initial" suspense policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'no-cache',
          suspensePolicy: 'initial',
          variables: { id },
        }),
      { mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change variables
    // 4. Unsuspend and return results from refetch
    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
    ]);
  });

  it('re-suspends the component when changing queries and using a "no-cache" fetch policy', async () => {
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
      ({ query }) => useSuspenseQuery(query, { fetchPolicy: 'no-cache' }),
      { mocks, initialProps: { query: query1 as DocumentNode } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: {},
      });
    });

    rerender({ query: query2 });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: {},
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change queries
    // 4. Initiate refetch and suspend
    // 5. Unsuspend and return results from refetch
    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
      { ...mocks[0].result, error: undefined, variables: {} },
      { ...mocks[1].result, error: undefined, variables: {} },
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
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: {},
      });
    });

    const cachedData = cache.readQuery({ query });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: { greeting: 'Hello' }, error: undefined, variables: {} },
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
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: {},
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: { greeting: 'Hello' }, error: undefined, variables: {} },
    ]);

    rerender();

    expect(result.current).toEqual({
      ...mocks[0].result,
      error: undefined,
      variables: {},
    });
    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: { greeting: 'Hello' }, error: undefined, variables: {} },
      { data: { greeting: 'Hello' }, error: undefined, variables: {} },
    ]);
  });

  it('ensures data is fetched is the correct amount of times when using a "no-cache" fetch policy', async () => {
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
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'no-cache',
          variables: { id },
        }),
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
  });

  it('does not write to the cache when using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const cache = new InMemoryCache();

    const { result } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'no-cache',
          variables: { id },
        }),
      { cache, mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    const cachedData = cache.readQuery({ query, variables: { id: '1' } });

    expect(cachedData).toBeNull();
  });

  it('does not respond to cache updates when using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'no-cache' }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    cache.writeQuery({
      query,
      data: { greeting: 'Updated hello' },
    });

    await wait(10);

    expect(result.current).toEqual({
      ...mocks[0].result,
      error: undefined,
      variables: {},
    });
    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
    ]);
  });

  it('re-suspends the component when changing variables and using a "cache-and-network" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'cache-and-network',
          variables: { id },
        }),
      { mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change variables
    // 4. Initiate refetch and suspend
    // 5. Unsuspend and return results from refetch
    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
    ]);
  });

  it('returns previous data on refetch when changing variables and using a "cache-and-network" with an "initial" suspense policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'cache-and-network',
          suspensePolicy: 'initial',
          variables: { id },
        }),
      { mocks, initialProps: { id: '1' } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change variables
    // 4. Unsuspend and return results from refetch
    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[0].result, error: undefined, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
    ]);
  });

  it('re-suspends the component when changing queries and using a "cache-and-network" fetch policy', async () => {
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
      ({ query }) =>
        useSuspenseQuery(query, { fetchPolicy: 'cache-and-network' }),
      { mocks, initialProps: { query: query1 as DocumentNode } }
    );

    expect(renders.suspenseCount).toBe(1);
    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: {},
      });
    });

    rerender({ query: query2 });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: {},
      });
    });

    // Renders:
    // 1. Initate fetch and suspend
    // 2. Unsuspend and return results from initial fetch
    // 3. Change queries
    // 4. Initiate refetch and suspend
    // 5. Unsuspend and return results from refetch
    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
      { ...mocks[0].result, error: undefined, variables: {} },
      { ...mocks[1].result, error: undefined, variables: {} },
    ]);
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

    expect(result.current).toEqual({
      data: { greeting: 'hello from cache' },
      error: undefined,
      variables: {},
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        error: undefined,
        variables: {},
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toEqual([
      {
        data: { greeting: 'hello from cache' },
        error: undefined,
        variables: {},
      },
      { data: { greeting: 'Hello' }, error: undefined, variables: {} },
    ]);
  });

  it('ensures data is fetched is the correct amount of times when using a "cache-and-network" fetch policy', async () => {
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
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'cache-and-network',
          variables: { id },
        }),
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
  });

  it('writes to the cache when using a "cache-and-network" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const cache = new InMemoryCache();

    const { result } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: 'cache-and-network',
          variables: { id },
        }),
      { cache, mocks, initialProps: { id: '1' } }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    const cachedData = cache.readQuery({ query, variables: { id: '1' } });

    expect(cachedData).toEqual(mocks[0].result.data);
  });

  it('responds to cache updates when using a "cache-and-network" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: 'cache-and-network' }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    cache.writeQuery({
      query,
      data: { greeting: 'Updated hello' },
    });

    await wait(10);

    expect(result.current).toEqual({
      data: { greeting: 'Updated hello' },
      error: undefined,
      variables: {},
    });
    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(3);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
      { data: { greeting: 'Updated hello' }, error: undefined, variables: {} },
    ]);
  });

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

    cache.writeQuery({ query, data: { greeting: 'hello from cache' } });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { client }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, error: undefined, variables: {} },
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
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    expect(renders.frames).toEqual([
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
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
      expect(result.current).toEqual({
        data: {
          vars: { source: 'local', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
        variables: { source: 'local', globalOnlyVar: true, localOnlyVar: true },
      });
    });

    rerender({ source: 'rerender' });

    await waitFor(() => {
      expect(result.current).toEqual({
        data: {
          vars: { source: 'rerender', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
        variables: {
          source: 'rerender',
          globalOnlyVar: true,
          localOnlyVar: true,
        },
      });
    });

    expect(renders.frames).toEqual([
      {
        data: {
          vars: { source: 'local', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
        variables: { source: 'local', globalOnlyVar: true, localOnlyVar: true },
      },
      {
        data: {
          vars: { source: 'local', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
        variables: { source: 'local', globalOnlyVar: true, localOnlyVar: true },
      },
      {
        data: {
          vars: { source: 'rerender', globalOnlyVar: true, localOnlyVar: true },
        },
        error: undefined,
        variables: {
          source: 'rerender',
          globalOnlyVar: true,
          localOnlyVar: true,
        },
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
      expect(result.current).toEqual({
        data: { vars: { source: 'local' } },
        error: undefined,
        variables: { source: 'local' },
      });
    });

    // Check to make sure the property itself is not defined, not just set to
    // undefined. Unfortunately this is not caught by toEqual as toEqual only
    // checks if the values are equal, not if they have the same keys
    expect(result.current.variables).not.toHaveProperty('globalOnlyVar');
    expect(result.current.data.vars).not.toHaveProperty('globalOnlyVar');

    expect(renders.frames).toEqual([
      {
        data: { vars: { source: 'local' } },
        error: undefined,
        variables: { source: 'local' },
      },
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
      expect(result.current).toEqual({
        data: { context: { valueA: 'A', valueB: 'B' } },
        error: undefined,
        variables: {},
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
      expect(result.current).toEqual({
        data: undefined,
        error: undefined,
        variables: {},
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: undefined, error: undefined, variables: {} },
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
      expect(result.current).toEqual({
        data: undefined,
        error: undefined,
        variables: {},
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: undefined, error: undefined, variables: {} },
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
      expect(result.current).toEqual({
        data: { currentUser: { id: '1', name: null } },
        error: undefined,
        variables: {},
      });
    });

    expect(renders.frames).toEqual([
      {
        data: { currentUser: { id: '1', name: null } },
        error: undefined,
        variables: {},
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
      expect(result.current).toEqual({
        data: undefined,
        error: undefined,
        variables: {},
      });
    });

    expect(renders.frames).toEqual([
      {
        data: undefined,
        error: undefined,
        variables: {},
      },
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
      expect(result.current).toEqual({
        data: undefined,
        error: new ApolloError({ networkError }),
        variables: {},
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      {
        data: undefined,
        error: new ApolloError({ networkError }),
        variables: {},
      },
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
      expect(result.current).toEqual({
        data: undefined,
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
        variables: {},
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      {
        data: undefined,
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
        variables: {},
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
      expect(result.current).toEqual({
        data: undefined,
        error: expectedError,
        variables: {},
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      {
        data: undefined,
        error: expectedError,
        variables: {},
      },
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
      expect(result.current).toEqual({
        data: { currentUser: { id: '1', name: null } },
        error: expectedError,
        variables: {},
      });
    });

    expect(renders.frames).toEqual([
      {
        data: { currentUser: { id: '1', name: null } },
        error: expectedError,
        variables: {},
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
      expect(result.current).toEqual({
        data: undefined,
        error: expectedError,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    expect(renders.count).toBe(5);
    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toEqual([
      { data: undefined, error: expectedError, variables: { id: '1' } },
      { data: undefined, error: expectedError, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
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
      expect(result.current).toEqual({
        data: undefined,
        error: expectedError,
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
        error: undefined,
        variables: { id: '2' },
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: undefined, error: expectedError, variables: { id: '1' } },
      { data: undefined, error: expectedError, variables: { id: '1' } },
      { ...mocks[1].result, error: undefined, variables: { id: '2' } },
    ]);
  });
});
