import React, { Suspense } from 'react';
import { render, screen, renderHook, waitFor } from '@testing-library/react';
import { ErrorBoundary, ErrorBoundaryProps } from 'react-error-boundary';
import {
  gql,
  NetworkStatus,
  ApolloClient,
  NormalizedCacheObject,
  ApolloQueryResult,
} from '../../../core';
import { MockedProvider, MockLink, mockSingleLink } from '../../../testing';
import {
  useBackgroundQuery_experimental as useBackgroundQuery,
  useReadQuery,
} from '../useBackgroundQuery';
import { ApolloProvider } from '../../context';
import { SuspenseCache } from '../../cache';
import { InMemoryCache } from '../../../cache';

// todo: in uBQ await the promise and check its resolved value
// todo: do the same on refetch

function renderIntegrationTest<Result>({
  client,
  promise,
}: {
  client?: ApolloClient<NormalizedCacheObject>;
  promise?: Promise<ApolloQueryResult<any>>;
} = {}) {
  // query
  const query = gql`
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
  interface Renders<Result> {
    errors: Error[];
    errorCount: number;
    suspenseCount: number;
    count: number;
  }
  const renders: Renders<Result> = {
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

  function Child({ promise }: { promise }) {
    const { data } = useReadQuery<{ data: { foo: { bar: string } } }>(promise);
    return <div>{data.foo.bar}</div>;
  }

  function UBQParent() {
    const { promise } = useBackgroundQuery(query);
    // count renders in the parent component
    renders.count++;
    return <Child promise={promise} />;
  }

  function Parent({ promise }) {
    // const { promise } = useBackgroundQuery(query);
    // count renders in the parent component
    // renders.count++;
    if (promise) {
      renders.count++;
      return <Child promise={promise} />;
    }
    return <UBQParent />;
  }

  function App({ promise }) {
    return (
      <ApolloProvider client={_client} suspenseCache={suspenseCache}>
        <ErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent promise={promise} />
          </Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const { ...rest } = render(<App promise={promise} />);
  return { ...rest, query, client: _client, renders };
}

describe('useBackgroundQuery', () => {
  it.only('fetches a simple query with minimal config', async () => {
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

    const { promise } = result.current;

    const _result = await promise;

    expect(_result).toEqual({
      data: { hello: 'world 1' },
      loading: false,
      networkStatus: 7,
    });
  });

  describe('fetch policy behaviors', () => {
    describe('cache-and-network', () => {
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

        const { promise, observable } = result.current;
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

        const { promise, observable } = result.current;

        // cache data exists so the observable never enters loading state
        await waitFor(() => {
          expect(observable.getCurrentResult().loading).toBe(false);
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.ready
        );
        expect(promise.status).toBe('pending');
        // cache data is returned without going to the network
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from cache',
        });

        // TODO: what is the expected behavior here?
        // expect(promise.status).toBe('fulfilled');
      });
      it('partial data is present in the cache so it is ignored and network request is made', async () => {
        const query = gql`
          {
            hello
            foo
          }
        `;
        // we expect a "Missing field 'foo' while writing result..." error
        // when writing hello to the cache, so we'll silence the console.error
        const originalConsoleError = console.error;
        console.error = () => {
          /* noop */
        };
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

        const { promise, observable } = result.current;

        // the result is loading and initial data is in the cache
        expect(observable.getCurrentResult().loading).toBe(true);
        // since all requested data isn't present in the cache,
        // undefined is returned
        expect(observable.getCurrentResult().data).toEqual(undefined);
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.loading
        );
        expect(promise.status).toBe('pending');

        await waitFor(() => {
          expect(observable.getCurrentResult().loading).toBe(false);
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.ready
        );
        expect(promise.status).toBe('fulfilled');
        // data has been replaced by the link data
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from link',
          foo: 'bar',
        });
        console.error = originalConsoleError;
        expect(client.cache.extract()).toEqual({
          ROOT_QUERY: { __typename: 'Query', hello: 'from link', foo: 'bar' },
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

        const { promise, observable } = result.current;

        expect(observable.getCurrentResult().loading).toBe(true);
        // do not return initial cache data with network-only fetch policy
        expect(observable.getCurrentResult().data).toEqual(undefined);
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.loading
        );
        expect(promise.status).toBe('pending');

        await waitFor(() => {
          expect(observable.getCurrentResult().loading).toBe(false);
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.ready
        );
        expect(promise.status).toBe('fulfilled');
        // data has been replaced by the link data
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from link',
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

        const { promise, observable } = result.current;

        // the result is loading and initial data is in the cache
        expect(observable.getCurrentResult().loading).toBe(true);
        expect(observable.getCurrentResult().data).toEqual(undefined);
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.loading
        );
        expect(promise.status).toBe('pending');

        await waitFor(() => {
          expect(observable.getCurrentResult().loading).toBe(false);
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.ready
        );

        expect(promise.status).toBe('fulfilled');

        // data has been replaced by the link data
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from link',
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

  it('is compatible with client.query()', async () => {
    const query = gql`
      query SimpleQuery {
        foo {
          bar
        }
      }
    `;
    const mocks = [
      {
        request: { query },
        result: { data: { foo: { bar: 'hello' } } },
      },
    ];
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const promise = client.query({ query });
    console.log(promise);

    const { renders } = renderIntegrationTest({ promise });

    // client.writeQuery({
    //   query,
    //   data: { foo: { bar: 'bat' } },
    // });
    // expect(renders.suspenseCount).toBe(1);

    // expect(await screen.findByText('bat')).toBeInTheDocument();
  });

  // it('suspends when partial data is in the cache (test all cache policies)', async () => {

  // });

  // it('uses useTransition to determine whether to resuspend on refetch', async () => {

  // });
});
