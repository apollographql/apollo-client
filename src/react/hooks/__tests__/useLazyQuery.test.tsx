import React from 'react';
import { GraphQLError } from 'graphql';
import gql from 'graphql-tag';
import { act, renderHook, waitFor } from '@testing-library/react';

import { 
  ApolloClient,
  ApolloLink,
  ErrorPolicy,
  InMemoryCache,
  NetworkStatus,
  TypedDocumentNode 
} from '../../../core';
import { Observable } from '../../../utilities';
import { ApolloProvider, resetApolloContext } from '../../../react';
import { 
  MockedProvider,
  mockSingleLink,
  wait,
  tick,
  MockSubscriptionLink 
} from '../../../testing';
import { useLazyQuery } from '../useLazyQuery';
import { QueryResult } from '../../types/types';

const IS_REACT_18 = React.version.startsWith("18");

describe('useLazyQuery Hook', () => {
  afterEach(() => {
    resetApolloContext();
  });
  const helloQuery: TypedDocumentNode<{
    hello: string;
  }> = gql`query { hello }`;

  it('should hold query execution until manually triggered', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: 'world' } },
        delay: 20,
      },
    ];
    const { result } = renderHook(
      () => useLazyQuery(helloQuery),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);
    const execute = result.current[0];
    setTimeout(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({ hello: 'world' });
  });

  it('should set `called` to false by default', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: 'world' } },
        delay: 20,
      },
    ];
    const { result } = renderHook(
      () => useLazyQuery(helloQuery),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].called).toBe(false);
  });

  it('should set `called` to true after calling the lazy execute function', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: 'world' } },
        delay: 20,
      },
    ];

    const { result } = renderHook(
      () => useLazyQuery(helloQuery),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].called).toBe(false);
    const execute = result.current[0];
    setTimeout(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });
    expect(result.current[1].called).toBe(true);

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].called).toBe(true);
  });

  it('should override `skip` if lazy mode execution function is called', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: 'world' } },
        delay: 20,
      },
    ];

    const { result } = renderHook(
      // skip isn’t actually an option on the types
      () => useLazyQuery(helloQuery, { skip: true } as any),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].called).toBe(false);
    const execute = result.current[0];
    setTimeout(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });
    expect(result.current[1].called).toBe(true);

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].called).toBe(true);
  });

  it('should use variables defined in hook options (if any), when running the lazy execution function', async () => {
    const query = gql`
      query($id: number) {
        hello(id: $id)
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: 1 } },
        result: { data: { hello: 'world 1' } },
        delay: 20,
      },
    ];

    const { result } = renderHook(
      () => useLazyQuery(query, {
        variables: { id: 1 },
      }),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    const execute = result.current[0];
    setTimeout(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });

    expect(result.current[1].data).toEqual({ hello: 'world 1' });
  });

  it('should use variables passed into lazy execution function, overriding similar variables defined in Hook options', async () => {
    const query = gql`
      query($id: number) {
        hello(id: $id)
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: 1 } },
        result: { data: { hello: 'world 1' } },
        delay: 20,
      },
      {
        request: { query, variables: { id: 2 } },
        result: { data: { hello: 'world 2' } },
        delay: 20,
      },
    ];

    const { result } = renderHook(
      () => useLazyQuery(query, {
        variables: { id: 1 },
      }),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    const execute = result.current[0];
    setTimeout(() => execute({ variables: { id: 2 } }));

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({ hello: 'world 2' });
  });

  it('should merge variables from original hook and execution function', async () => {
    const counterQuery: TypedDocumentNode<{
      counter: number;
    }, {
      hookVar?: boolean;
      execVar?: boolean;
      localDefaultVar?: boolean;
      globalDefaultVar?: boolean;
    }> = gql`
      query GetCounter (
        $hookVar: Boolean
        $execVar: Boolean
        $localDefaultVar: Boolean
        $globalDefaultVar: Boolean
      ) {
        counter
        vars
      }
    `;

    let count = 0;
    const client = new ApolloClient({
      defaultOptions: {
        watchQuery: {
          variables: {
            globalDefaultVar: true,
          },
        },
      },
      cache: new InMemoryCache(),
      link: new ApolloLink(request => new Observable(observer => {
        if (request.operationName === "GetCounter") {
          observer.next({
            data: {
              counter: ++count,
              vars: request.variables,
            },
          });
          setTimeout(() => {
            observer.complete();
          }, 10);
        } else {
          observer.error(new Error(`Unknown query: ${
            request.operationName || request.query
          }`));
        }
      })),
    });

    const { result } = renderHook(
      () => {
        const [exec, query] = useLazyQuery(counterQuery, {
          notifyOnNetworkStatusChange: true,
          variables: {
            hookVar: true,
          },
          defaultOptions: {
            variables: {
              localDefaultVar: true,
            },
          },
        });
        return {
          exec,
          query,
        };
      },
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    await waitFor(() => {
      expect(result.current.query.loading).toBe(false);
    }, { interval: 1 });
    await waitFor(() => {
      expect(result.current.query.called).toBe(false);
    }, { interval: 1 });
    await waitFor(() => {
      expect(result.current.query.data).toBeUndefined();
    }, { interval: 1 });

    const expectedFinalData = {
      counter: 1,
      vars: {
        globalDefaultVar: true,
        localDefaultVar: true,
        hookVar: true,
        execVar: true,
      },
    };

    const execResult = await result.current.exec(
      {
        variables: {
          execVar: true
        }
      }
    );

    await waitFor(() => {
      expect(execResult.loading).toBe(false);
    }, { interval: 1 });
    await waitFor(() => {
      expect(execResult.called).toBe(true);
    }, { interval: 1 });
    await waitFor(() => {
      expect(execResult.networkStatus).toBe(NetworkStatus.ready);
    }, { interval: 1 });
    await waitFor(() => {
      expect(execResult.data).toEqual(expectedFinalData);
    }, { interval: 1 });
    await waitFor(() => {
      expect(result.current.query.called).toBe(true);
    }, { interval: 1 });
    await waitFor(() => {
      expect(result.current.query.loading).toBe(false);
    }, { interval: 10 });

    expect(result.current.query.called).toBe(true);
    expect(result.current.query.data).toEqual(expectedFinalData);

    const refetchResult = await result.current.query.reobserve({
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-first",
      variables: {
        execVar: false,
      },
    });
    expect(refetchResult.loading).toBe(false);
    expect(refetchResult.data).toEqual({
      counter: 2,
      vars: {
        execVar: false,
      },
    });

    await waitFor(() => {
      expect(result.current.query.loading).toBe(false);
    }, { interval: 1 });
    await waitFor(() => {
      expect(result.current.query.called).toBe(true);
    }, { interval: 1 });
    await waitFor(() => {
      expect(result.current.query.data).toEqual({
        counter: 2,
        vars: {
          execVar: false,
        },
      });
    }, { interval: 1 });

    const execResult2 = await result.current.exec({
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      variables: {
        execVar: true,
      },
    });

    await waitFor(() => {
      expect(execResult2.loading).toBe(false);
    }, { interval: 1 });
    await waitFor(() => {
      expect(execResult2.called).toBe(true);
    }, { interval: 1 });
    await waitFor(() => {
      expect(execResult2.data).toEqual({
        counter: 3,
        vars: {
          ...expectedFinalData.vars,
          execVar: true,
        },
      });
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current.query.called).toBe(true);
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current.query.loading).toBe(false);
    }, { interval: 10 });
    expect(result.current.query.called).toBe(true);
    expect(result.current.query.data).toEqual({
      counter: 3,
      vars: {
        ...expectedFinalData.vars,
        execVar: true,
      },
    });
  });


  it("changing queries", async () => {
    const query1 = gql`
      query {
        hello
      }
    `;
    const query2 = gql`
      query {
        name
      }
    `;
    const mocks = [
      {
        request: { query: query1 },
        result: { data: { hello: "world" } },
        delay: 20
      },
      {
        request: { query: query2 },
        result: { data: { name: "changed" } },
        delay: 20
      },
    ];

    const cache = new InMemoryCache();
    const { result } = renderHook(() => useLazyQuery(query1), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      ),
    });

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);
    const execute = result.current[0];

    setTimeout(() => execute());

    await waitFor(
      () => {
        expect(result.current[1].loading).toBe(true);
      },
      { interval: 1 }
    );

    await waitFor(
      () => {
        expect(result.current[1].loading).toBe(false);
      },
      { interval: 1 }
    );
    expect(result.current[1].data).toEqual({ hello: "world" });

    setTimeout(() => execute({ query: query2 }));

    await waitFor(
      () => {
        expect(result.current[1].loading).toBe(true);
      },
      { interval: 1 }
    );

    await waitFor(
      () => {
        expect(result.current[1].loading).toBe(false);
      },
      { interval: 1 }
    );
    expect(result.current[1].data).toEqual({ name: "changed" });
  });

  it('should fetch data each time the execution function is called, when using a "network-only" fetch policy', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: 'world 1' } },
        delay: 20,
      },
      {
        request: { query: helloQuery },
        result: { data: { hello: 'world 2' } },
        delay: 20,
      },
    ];

    const { result } = renderHook(
      () => useLazyQuery(helloQuery, {
        fetchPolicy: 'network-only',
      }),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    expect(result.current[1].loading).toBe(false);
    const execute = result.current[0];
    setTimeout(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({ hello: 'world 1' });

    setTimeout(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({ hello: 'world 1' });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({ hello: 'world 2' });
  });

  it('should persist previous data when a query is re-run', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: 'world 1' } },
        delay: 20,
      },
      {
        request: { query: helloQuery },
        result: { data: { hello: 'world 2' } },
        delay: 20,
      },
    ];

    const { result } = renderHook(
      () => useLazyQuery(helloQuery, {
        notifyOnNetworkStatusChange: true,
      }),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].previousData).toBe(undefined);
    const execute = result.current[0];
    setTimeout(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].previousData).toBe(undefined);

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({ hello: 'world 1' });
    expect(result.current[1].previousData).toBe(undefined);

    const refetch = result.current[1].refetch;
    setTimeout(() => refetch!());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({ hello: 'world 1' });
    expect(result.current[1].previousData).toEqual({ hello: 'world 1' });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({ hello: 'world 2' });
    expect(result.current[1].previousData).toEqual({ hello: 'world 1' });
  });

  it('should allow for the query to start with polling', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: "world 1" } },
        delay: 10,
      },
      {
        request: { query: helloQuery },
        result: { data: { hello: "world 2" } },
      },
      {
        request: { query: helloQuery },
        result: { data: { hello: "world 3" } },
      },
    ];

    const wrapper = ({ children }: any) => (
      <MockedProvider mocks={mocks}>{children}</MockedProvider>
    );

    const { result } = renderHook(
      () => useLazyQuery(helloQuery),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });

    expect(result.current[1].data).toBe(undefined);

    await tick();
    result.current[1].startPolling(10);

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    await waitFor(() => {
      if (IS_REACT_18) {
        expect(result.current[1].data).toEqual({ hello: "world 1" });
      } else {
        expect(result.current[1].data).toEqual({ hello: "world 3" });
      }
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    await waitFor(() => {
      if (IS_REACT_18) {
        expect(result.current[1].data).toEqual({ hello: "world 2" });
      } else {
        expect(result.current[1].data).toEqual({ hello: "world 3" });
      }
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    await waitFor(() => {
      expect(result.current[1].data).toEqual({ hello: "world 3" });
    }, { interval: 1 });

    result.current[1].stopPolling();
  });

  it('should persist previous data when a query is re-run and variable changes', async () => {
    const CAR_QUERY_BY_ID = gql`
      query($id: Int) {
        car(id: $id) {
          make
          model
        }
      }
    `;

    const data1 = {
      car: {
        make: 'Audi',
        model: 'A4',
        __typename: 'Car',
      },
    };

    const data2 = {
      car: {
        make: 'Audi',
        model: 'RS8',
        __typename: 'Car',
      },
    };

    const mocks = [
      {
        request: { query: CAR_QUERY_BY_ID, variables: { id: 1 } },
        result: { data: data1 },
        delay: 20,
      },
      {
        request: { query: CAR_QUERY_BY_ID, variables: { id: 2 } },
        result: { data: data2 },
        delay: 20,
      },
    ];

    const { result } = renderHook(
      () => useLazyQuery(CAR_QUERY_BY_ID),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      }
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].previousData).toBe(undefined);
    const execute = result.current[0];
    setTimeout(() => execute({ variables: { id: 1 }}));

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].previousData).toBe(undefined);

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual(data1);
    expect(result.current[1].previousData).toBe(undefined);

    setTimeout(() => execute({ variables: { id: 2 }}));

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].previousData).toEqual(data1);

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual(data2);
    expect(result.current[1].previousData).toEqual(data1);
  });

  it('should work with cache-and-network fetch policy', async () => {
    const cache = new InMemoryCache();
    const link = mockSingleLink(
      {
        request: { query: helloQuery },
        result: { data: { hello: 'from link' } },
        delay: 20,
      },
    );

    const client = new ApolloClient({
      link,
      cache,
    });

    cache.writeQuery({ query: helloQuery, data: { hello: 'from cache' }});

    const { result } = renderHook(
      () => useLazyQuery(helloQuery, { fetchPolicy: 'cache-and-network' }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);
    const execute = result.current[0];
    setTimeout(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });

    // TODO: FIXME
    expect(result.current[1].data).toEqual({ hello: 'from cache' });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({ hello: 'from link' });
  });

  it('should return a promise from the execution function which resolves with the result', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: 'world' } },
        delay: 20,
      },
    ];
    const { result } = renderHook(
      () => useLazyQuery(helloQuery),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);
    const execute = result.current[0];

    const executeResult = new Promise<QueryResult<any, any>>(resolve => {
      setTimeout(() => resolve(execute()));
    });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });

    let latestRenderResult: QueryResult;
    await waitFor(() => {
      latestRenderResult = result.current[1];
      expect(latestRenderResult.loading).toBe(false);
    });
    await waitFor(() => {
      latestRenderResult = result.current[1];
      expect(latestRenderResult.data).toEqual({ hello: 'world' });
    });

    return executeResult.then(finalResult => {
      expect(finalResult).toEqual(latestRenderResult);
    });
  });

  it('should have matching results from execution function and hook', async () => {
    const query = gql`
      query GetCountries($filter: String) {
        countries(filter: $filter) {
          code
          name
        }
      }
    `;

    const mocks = [
      {
        request: {
          query,
          variables: {
            filter: "PA",
          },
        },
        result: {
          data: {
            countries: {
              code: "PA",
              name: "Panama",
            },
          },
        },
        delay: 20,
      },
      {
        request: {
          query,
          variables: {
            filter: "BA",
          },
        },
        result: {
          data: {
            countries: {
              code: "BA",
              name: "Bahamas",
            },
          },
        },
        delay: 20,
      },
    ];

    const { result } = renderHook(
      () => useLazyQuery(query),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);
    const execute = result.current[0];
    let executeResult: any;
    setTimeout(() => {
      executeResult = execute({ variables: { filter: "PA" } });
    });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toEqual({
      countries: {
        code: "PA",
        name: "Panama",
      },
    });

    expect(executeResult).toBeInstanceOf(Promise);
    expect((await executeResult).data).toEqual({
      countries: {
        code: "PA",
        name: "Panama",
      },
    });

    setTimeout(() => {
      executeResult = execute({ variables: { filter: "BA" } });
    });

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    await waitFor(() => {
      expect(result.current[1].data).toEqual({
        countries: {
          code: "BA",
          name: "Bahamas",
        },
      });
    }, { interval: 1 });

    expect(executeResult).toBeInstanceOf(Promise);
    expect((await executeResult).data).toEqual({
      countries: {
        code: "BA",
        name: "Bahamas",
      },
    });
  });

  it('the promise should reject with errors the “way useMutation does”', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: {
          errors: [new GraphQLError('error 1')],
        },
        delay: 20,
      },
      {
        request: { query: helloQuery },
        result: {
          errors: [new GraphQLError('error 2')],
        },
        delay: 20,
      },
    ];

    const { result } = renderHook(
      () => useLazyQuery(helloQuery),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    const execute = result.current[0];
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBeUndefined();

    const executePromise = Promise.resolve().then(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });
    expect(result.current[1].data).toBeUndefined();
    expect(result.current[1].error).toBe(undefined);

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toBeUndefined();
    expect(result.current[1].error).toEqual(new Error('error 1'));

    await executePromise.then(result => {
      expect(result.loading).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error!.message).toBe('error 1');
    });

    setTimeout(() => execute());

    await waitFor(() => {
      expect(result.current[1].loading).toBe(true);
    }, { interval: 1 });
    expect(result.current[1].data).toBeUndefined();
    expect(result.current[1].error).toEqual(new Error('error 1'));

    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
    }, { interval: 1 });
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].error).toEqual(new Error('error 2'));
  });

  it('the promise should not cause an unhandled rejection', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: {
          errors: [new GraphQLError('error 1')],
        },
      },
    ];

    const { result } = renderHook(
      () => useLazyQuery(helloQuery),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      },
    );

    const execute = result.current[0];
    await waitFor(() => {
      expect(result.current[1].loading).toBe(false);
      execute();
    }, { interval: 1 });
    await waitFor(() => {
      expect(result.current[1].data).toBe(undefined);
      execute();
    }, { interval: 1 });

    // Making sure the rejection triggers a test failure.
    await wait(50);
  });

  it('allows in-flight requests to resolve when component unmounts', async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({ link, cache: new InMemoryCache() })

    const { result, unmount } = renderHook(() => useLazyQuery(helloQuery), {
      wrapper: ({ children }) =>
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
    });

    const [execute] = result.current;

    let promise: Promise<QueryResult<{ hello: string }>>
    act(() => {
      promise = execute();
    })

    unmount();

    link.simulateResult({ result: { data: { hello: 'Greetings' }}}, true);

    const queryResult = await promise!;

    expect(queryResult.data).toEqual({ hello: 'Greetings' });
    expect(queryResult.loading).toBe(false);
    expect(queryResult.networkStatus).toBe(NetworkStatus.ready);
  });

  it('handles resolving multiple in-flight requests when component unmounts', async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({ link, cache: new InMemoryCache() })

    const { result, unmount } = renderHook(() => useLazyQuery(helloQuery), {
      wrapper: ({ children }) =>
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
    });

    const [execute] = result.current;

    let promise1: Promise<QueryResult<{ hello: string }>>
    let promise2: Promise<QueryResult<{ hello: string }>>
    act(() => {
      promise1 = execute();
      promise2 = execute();
    })

    unmount();

    link.simulateResult({ result: { data: { hello: 'Greetings' }}}, true);

    const expectedResult = {
      data: { hello: 'Greetings' },
      loading: false,
      networkStatus: NetworkStatus.ready,
    };

    await expect(promise1!).resolves.toMatchObject(expectedResult);
    await expect(promise2!).resolves.toMatchObject(expectedResult);
  });

  // https://github.com/apollographql/apollo-client/issues/9755
  it('resolves each execution of the query with the appropriate result and renders with the result from the latest execution', async () => {
    interface Data {
      user: { id: string, name: string }
    }

    interface Variables {
      id: string
    }

    const query: TypedDocumentNode<Data, Variables> = gql`
      query UserQuery($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: { data: { user: { id: '1', name: 'John Doe' }}},
        delay: 20
      },
      {
        request: { query, variables: { id: '2' } },
        result: { data: { user: { id: '2', name: 'Jane Doe' }}},
        delay: 20
      },
    ]

    const { result } = renderHook(() => useLazyQuery(query), {
      wrapper: ({ children }) =>
        <MockedProvider mocks={mocks}>
          {children}
        </MockedProvider>
    });

    const [execute] = result.current;

    await act(async () => {
      const promise1 = execute({ variables: { id: '1' }});
      const promise2 = execute({ variables: { id: '2' }});

      await expect(promise1).resolves.toMatchObject({
        ...mocks[0].result,
        loading: false ,
        called: true,
      });

      await expect(promise2).resolves.toMatchObject({
        ...mocks[1].result,
        loading: false ,
        called: true,
      });
    });

    expect(result.current[1]).toMatchObject({
      ...mocks[1].result,
      loading: false,
      called: true,
    });
  });

  it('uses the most recent options when the hook rerenders before execution', async () => {
    interface Data {
      user: { id: string, name: string }
    }

    interface Variables {
      id: string
    }

    const query: TypedDocumentNode<Data, Variables> = gql`
      query UserQuery($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: { data: { user: { id: '1', name: 'John Doe' }}},
        delay: 30
      },
      {
        request: { query, variables: { id: '2' } },
        result: { data: { user: { id: '2', name: 'Jane Doe' }}},
        delay: 20
      },
    ]

    const { result, rerender } = renderHook(
      ({ id }) => useLazyQuery(query, { variables: { id } }), 
      {
        initialProps: { id: '1' },
        wrapper: ({ children }) =>
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
      }
    );

    rerender({ id: '2' });

    const [execute] = result.current;

    let promise: Promise<QueryResult<Data, Variables>>;
    act(() => {
      promise = execute();
    });

    await waitFor(() => {
      expect(result.current[1].data).toEqual(mocks[1].result.data);
    })

    await expect(promise!).resolves.toMatchObject(
      { data: mocks[1].result.data }
    );
  });

  // https://github.com/apollographql/apollo-client/issues/10198
  it('uses the most recent query document when the hook rerenders before execution', async () => {
    const query = gql`
      query DummyQuery {
        shouldNotBeUsed
      }
    `;

    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: 'Greetings' } },
        delay: 20
      },
    ]

    const { result, rerender } = renderHook(
      ({ query }) => useLazyQuery(query), 
      {
        initialProps: { query },
        wrapper: ({ children }) =>
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
      }
    );

    rerender({ query: helloQuery });

    const [execute] = result.current;

    let promise: Promise<QueryResult<{ hello: string }>>;
    act(() => {
      promise = execute();
    });

    await waitFor(() => {
      expect(result.current[1].data).toEqual({ hello: 'Greetings' });
    })

    await expect(promise!).resolves.toMatchObject(
      { data: { hello: 'Greetings' } }
    );
  });

  it('does not refetch when rerendering after executing query', async () => {
    interface Data {
      user: { id: string, name: string }
    }

    interface Variables {
      id: string
    }

    const query: TypedDocumentNode<Data, Variables> = gql`
      query UserQuery($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    let fetchCount = 0;

    const link = new ApolloLink((operation) => {
      fetchCount++;
      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({ 
            data: { user: { id: operation.variables.id, name: 'John Doe' } }
          });
          observer.complete();
        }, 20)
      });
    });

    const client = new ApolloClient({ link, cache: new InMemoryCache() });

    const { result, rerender } = renderHook(
      () => useLazyQuery(query, { variables: { id: '1' }}), 
      {
        initialProps: { id: '1' },
        wrapper: ({ children }) =>
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
      }
    );

    const [execute] = result.current;

    await act(() => execute({ variables: { id: '2' }}));

    expect(fetchCount).toBe(1);

    rerender();

    await wait(10);

    expect(fetchCount).toBe(1);
  })

  describe("network errors", () => {
    async function check(errorPolicy: ErrorPolicy) {
      const networkError = new Error("from the network");

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(request => new Observable(observer => {
          setTimeout(() => {
            observer.error(networkError);
          }, 20);
        })),
      });

      const { result } = renderHook(
        () => useLazyQuery(helloQuery, {
          errorPolicy,
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      const execute = result.current[0];
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].networkStatus).toBe(NetworkStatus.ready);
      expect(result.current[1].data).toBeUndefined();

      setTimeout(execute);

      await waitFor(() => {
        expect(result.current[1].loading).toBe(true);
      }, { interval: 1 });
      await waitFor(() => {
        if (IS_REACT_18) {
          expect(result.current[1].networkStatus).toBe(NetworkStatus.loading);
        } else {
          expect(result.current[1].networkStatus).toBe(NetworkStatus.error);
        }
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[1].data).toBeUndefined();
      }, { interval: 1 });

      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[1].networkStatus).toBe(NetworkStatus.error);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[1].data).toBeUndefined();
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[1].error!.message).toBe("from the network");
      }, { interval: 1 });
    }

    // For errorPolicy:"none", we expect result.error to be defined and
    // result.data to be undefined, which is what we test above.
    it('handles errorPolicy:"none" appropriately', () => check("none"));

    // If there was any data to report, errorPolicy:"all" would report both
    // result.data and result.error, but there is no GraphQL data when we
    // encounter a network error, so the test again captures desired behavior.
    it('handles errorPolicy:"all" appropriately', () => check("all"));

    // Technically errorPolicy:"ignore" is supposed to throw away result.error,
    // but in the case of network errors, since there's no actual data to
    // report, it's useful/important that we report result.error anyway.
    it('handles errorPolicy:"ignore" appropriately', () => check("ignore"));
  });

  describe("options.defaultOptions", () => {
    it("defaultOptions do not confuse useLazyQuery", async () => {
      const counterQuery: TypedDocumentNode<{
        counter: number;
      }> = gql`
        query GetCounter {
          counter
        }
      `;

      let count = 0;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(request => new Observable(observer => {
          if (request.operationName === "GetCounter") {
            observer.next({
              data: {
                counter: ++count,
              },
            });
            setTimeout(() => {
              observer.complete();
            }, 10);
          } else {
            observer.error(new Error(`Unknown query: ${
              request.operationName || request.query
            }`));
          }
        })),
      });

      const defaultFetchPolicy = "network-only";

      const { result } = renderHook(
        () => {
          const [exec, query] = useLazyQuery(counterQuery, {
            defaultOptions: {
              fetchPolicy: defaultFetchPolicy,
              notifyOnNetworkStatusChange: true,
            },
          });
          return {
            exec,
            query,
          };
        },
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      await waitFor(() => {
        expect(result.current.query.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.query.called).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.query.data).toBeUndefined();
      }, { interval: 1 });

      const execResult = await result.current.exec();
      expect(execResult.loading).toBe(false);
      expect(execResult.called).toBe(true);
      expect(execResult.data).toEqual({ counter: 1 });

      await waitFor(() => {
        expect(result.current.query.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.query.data).toMatchObject({ counter: 1 });
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.query.called).toBe(true);
      }, { interval: 1 });

      await waitFor(() => {
        expect(result.current.query.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.query.called).toBe(true);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.query.data).toEqual({ counter: 1 });
      }, { interval: 1 });

      const { options } = result.current.query.observable;
      expect(options.fetchPolicy).toBe(defaultFetchPolicy);
    });
  });
});
