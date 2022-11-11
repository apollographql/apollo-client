import React, { Suspense } from 'react';
import {
  screen,
  renderHook,
  waitFor,
  RenderHookOptions,
} from '@testing-library/react';
import { InvariantError } from 'ts-invariant';
import { equal } from '@wry/equality';

import {
  gql,
  ApolloCache,
  ApolloClient,
  ApolloLink,
  DocumentNode,
  InMemoryCache,
  Observable,
  TypedDocumentNode,
} from '../../../core';
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

  const {
    cache,
    client,
    link,
    mocks = [],
    wrapper = ({ children }) => {
      return client ? (
        <ApolloProvider client={client} suspenseCache={new SuspenseCache()}>
          <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>
        </ApolloProvider>
      ) : (
        <MockedProvider cache={cache} mocks={mocks} link={link}>
          <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>
        </MockedProvider>
      );
    },
    ...renderHookOptions
  } = options;

  const renders: Renders<Result> = {
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

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[0].result,
        variables: {},
      });
    });

    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
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
        variables: { id: '1' },
      });
    });

    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
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
        variables: { id: '1' },
      });
    });

    rerender({ id: '1' });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[0].result, variables: { id: '1' } },
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
        variables: { id: '1' },
      });
    });

    const previousResult = result.current;

    rerender({ id: '1' });

    expect(result.current).toBe(previousResult);
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

    unmount();

    expect(client.getObservableQueries().size).toBe(1);
    expect(suspenseCache.getQuery(query)).not.toBeUndefined();
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

    const suspenseCache = new SuspenseCache();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { client: localClient }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={globalClient} suspenseCache={suspenseCache}>
            <Suspense fallback="loading">{children}</Suspense>
          </ApolloProvider>
        ),
      }
    );

    await waitFor(() =>
      expect(result.current.data).toEqual({ greeting: 'local hello' })
    );

    expect(renders.frames).toEqual([
      { data: { greeting: 'local hello' }, variables: {} },
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
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
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
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[1].result, variables: { id: '2' } },
    ]);
  });

  it('returns previous data on refetch when changing variables and using a "cache-first" and an "initial" suspense policy', async () => {
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
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
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
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[1].result, variables: { id: '2' } },
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
      expect(result.current).toEqual({ ...mocks[0].result, variables: {} });
    });

    rerender({ query: query2 });

    await waitFor(() => {
      expect(result.current).toEqual({ ...mocks[1].result, variables: {} });
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
      { ...mocks[0].result, variables: {} },
      { ...mocks[0].result, variables: {} },
      { ...mocks[1].result, variables: {} },
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
      variables: {},
    });

    expect(renders.count).toBe(1);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toEqual([
      { data: { greeting: 'hello from cache' }, variables: {} },
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
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
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
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[1].result, variables: { id: '2' } },
    ]);
  });

  it('returns previous data on refetch when changing variables and using a "network-only" and an "initial" suspense policy', async () => {
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
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
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
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[1].result, variables: { id: '2' } },
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
      expect(result.current).toEqual({ ...mocks[0].result, variables: {} });
    });

    rerender({ query: query2 });

    await waitFor(() => {
      expect(result.current).toEqual({ ...mocks[1].result, variables: {} });
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
      { ...mocks[0].result, variables: {} },
      { ...mocks[0].result, variables: {} },
      { ...mocks[1].result, variables: {} },
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
        variables: {},
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: { greeting: 'Hello' }, variables: {} },
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
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
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
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[1].result, variables: { id: '2' } },
    ]);
  });

  it('returns previous data on refetch when changing variables and using a "no-cache" and an "initial" suspense policy', async () => {
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
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
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
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[1].result, variables: { id: '2' } },
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
      expect(result.current).toEqual({ ...mocks[0].result, variables: {} });
    });

    rerender({ query: query2 });

    await waitFor(() => {
      expect(result.current).toEqual({ ...mocks[1].result, variables: {} });
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
      { ...mocks[0].result, variables: {} },
      { ...mocks[0].result, variables: {} },
      { ...mocks[1].result, variables: {} },
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
        variables: {},
      });
    });

    const cachedData = cache.readQuery({ query });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: { greeting: 'Hello' }, variables: {} },
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
        variables: {},
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: { greeting: 'Hello' }, variables: {} },
    ]);

    rerender();

    expect(result.current).toEqual({ ...mocks[0].result, variables: {} });
    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([
      { data: { greeting: 'Hello' }, variables: {} },
      { data: { greeting: 'Hello' }, variables: {} },
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
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
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
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[1].result, variables: { id: '2' } },
    ]);
  });

  it('returns previous data on refetch when changing variables and using a "cache-and-network" and an "initial" suspense policy', async () => {
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
        variables: { id: '1' },
      });
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({
        ...mocks[1].result,
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
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[0].result, variables: { id: '1' } },
      { ...mocks[1].result, variables: { id: '2' } },
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
      expect(result.current).toEqual({ ...mocks[0].result, variables: {} });
    });

    rerender({ query: query2 });

    await waitFor(() => {
      expect(result.current).toEqual({ ...mocks[1].result, variables: {} });
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
      { ...mocks[0].result, variables: {} },
      { ...mocks[0].result, variables: {} },
      { ...mocks[1].result, variables: {} },
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
      variables: {},
    });

    await waitFor(() => {
      expect(result.current).toEqual({ ...mocks[0].result, variables: {} });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toEqual([
      { data: { greeting: 'hello from cache' }, variables: {} },
      { data: { greeting: 'Hello' }, variables: {} },
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
    expect(renders.frames).toEqual([{ ...mocks[0].result, variables: {} }]);
  });
});
