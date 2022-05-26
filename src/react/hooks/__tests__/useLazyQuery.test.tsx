import React from 'react';
import { GraphQLError } from 'graphql';
import gql from 'graphql-tag';
import { renderHook } from '@testing-library/react-hooks';
import { act } from 'react-dom/test-utils';

import { ApolloClient, ApolloLink, ErrorPolicy, InMemoryCache, NetworkStatus, TypedDocumentNode } from '../../../core';
import { Observable } from '../../../utilities';
import { ApolloProvider } from '../../../react';
import { MockedProvider, mockSingleLink } from '../../../testing';
import { useLazyQuery } from '../useLazyQuery';
import { QueryResult } from '../../types/types';

describe('useLazyQuery Hook', () => {
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
    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].called).toBe(true);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].called).toBe(true);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();

    expect(result.current[1].loading).toBe(true);
    await waitForNextUpdate();

    expect(result.current[1].loading).toBe(false);
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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
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

    const { result, waitForNextUpdate } = renderHook(
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

    expect(result.current.query.loading).toBe(false);
    expect(result.current.query.called).toBe(false);
    expect(result.current.query.data).toBeUndefined();

    await expect(waitForNextUpdate({
      timeout: 20,
    })).rejects.toThrow('Timed out');

    const expectedFinalData = {
      counter: 1,
      vars: {
        globalDefaultVar: true,
        localDefaultVar: true,
        hookVar: true,
        execVar: true,
      },
    };

    const execPromise = act(() => result.current.exec({
      variables: {
        execVar: true,
      },
    }).then(finalResult => {
      expect(finalResult.loading).toBe(false);
      expect(finalResult.called).toBe(true);
      expect(finalResult.data).toEqual(expectedFinalData);
    }));

    expect(result.current.query.loading).toBe(true);
    expect(result.current.query.called).toBe(true);
    expect(result.current.query.data).toBeUndefined();
    await waitForNextUpdate();
    expect(result.current.query.loading).toBe(false);
    expect(result.current.query.called).toBe(true);
    expect(result.current.query.data).toEqual(expectedFinalData);

    await execPromise;

    await expect(waitForNextUpdate({
      timeout: 20,
    })).rejects.toThrow('Timed out');

    const refetchPromise = act(() => result.current.query.reobserve({
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-first",
      variables: {
        execVar: false,
      },
    }).then(finalResult => {
      expect(finalResult.loading).toBe(false);
      expect(finalResult.data).toEqual({
        counter: 2,
        vars: {
          execVar: false,
        },
      });
    }));
    await waitForNextUpdate();
    expect(result.current.query.loading).toBe(false);
    expect(result.current.query.called).toBe(true);
    expect(result.current.query.data).toEqual({
      counter: 2,
      vars: {
        execVar: false,
      },
    });

    await refetchPromise;

    await expect(waitForNextUpdate({
      timeout: 20,
    })).rejects.toThrow('Timed out');

    const execPromise2 = act(() => result.current.exec({
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      variables: {
        execVar: true,
      },
    }).then(finalResult => {
      expect(finalResult.loading).toBe(false);
      expect(finalResult.called).toBe(true);
      expect(finalResult.data).toEqual({
        counter: 3,
        vars: {
          ...expectedFinalData.vars,
          execVar: true,
        },
      });
    }));

    expect(result.current.query.loading).toBe(true);
    expect(result.current.query.called).toBe(true);
    expect(result.current.query.data).toEqual({
      counter: 2,
      vars: {
        execVar: false,
      },
    });
    await waitForNextUpdate();
    expect(result.current.query.loading).toBe(false);
    expect(result.current.query.called).toBe(true);
    expect(result.current.query.data).toEqual({
      counter: 3,
      vars: {
        ...expectedFinalData.vars,
        execVar: true,
      },
    });

    await execPromise2;

    await expect(waitForNextUpdate({
      timeout: 20,
    })).rejects.toThrow('Timed out');
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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({ hello: 'world 1' });

    setTimeout(() => execute());

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].data).toEqual({ hello: 'world 1' });

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].previousData).toBe(undefined);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({ hello: 'world 1' });
    expect(result.current[1].previousData).toBe(undefined);

    const refetch = result.current[1].refetch;
    setTimeout(() => refetch!());

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].data).toEqual({ hello: 'world 1' });
    expect(result.current[1].previousData).toEqual({ hello: 'world 1' });

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
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

    const { result, waitForNextUpdate } = renderHook(
      () => useLazyQuery(helloQuery),
      { wrapper },
    );

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);

    setTimeout(() => {
      result.current[1].startPolling(10);
    });

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({ hello: "world 1" });

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({ hello: "world 2" });

    await waitForNextUpdate();

    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({ hello: "world 3" });

    result.current[1].stopPolling();
    await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].previousData).toBe(undefined);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual(data1);
    expect(result.current[1].previousData).toBe(undefined);

    setTimeout(() => execute({ variables: { id: 2 }}));

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].previousData).toEqual(data1);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();

    // TODO: FIXME
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].data).toEqual({ hello: 'from cache' });

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
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
    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);

    await waitForNextUpdate();
    const latestRenderResult = result.current[1];
    expect(latestRenderResult.loading).toBe(false);
    expect(latestRenderResult.data).toEqual({ hello: 'world' });

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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
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

    await waitForNextUpdate();
    // TODO: Get rid of this render.

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({
      countries: {
        code: "BA",
        name: "Bahamas",
      },
    });

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

    const { result, waitForNextUpdate } = renderHook(
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

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].data).toBeUndefined();
    expect(result.current[1].error).toBe(undefined);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBeUndefined();
    expect(result.current[1].error).toEqual(new Error('error 1'));

    await executePromise.then(result => {
      expect(result.loading).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error!.message).toBe('error 1');
    });

    await expect(waitForNextUpdate({
      timeout: 20,
    })).rejects.toThrow('Timed out');

    setTimeout(() => execute());

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);
    expect(result.current[1].data).toBeUndefined();
    expect(result.current[1].error).toEqual(new Error('error 1'));

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toBe(undefined);
    expect(result.current[1].error).toEqual(new Error('error 2'));

    await expect(waitForNextUpdate({
      timeout: 20,
    })).rejects.toThrow('Timed out');
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

    const { result, waitForNextUpdate } = renderHook(
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
    expect(result.current[1].data).toBe(undefined);
    setTimeout(() => {
      execute();
    });

    await waitForNextUpdate();

    // Making sure the rejection triggers a test failure.
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  describe("network errors", () => {
    async function check(errorPolicy: ErrorPolicy) {
      const networkError = new Error("from the network");

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(request => new Observable(observer => {
          setTimeout(() => {
            observer.error(networkError);
          });
        })),
      });

      const { result, waitForNextUpdate } = renderHook(
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

      await expect(waitForNextUpdate({
        timeout: 20,
      })).rejects.toThrow('Timed out');

      setTimeout(execute);

      await waitForNextUpdate();
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].networkStatus).toBe(NetworkStatus.loading);
      expect(result.current[1].data).toBeUndefined();

      await waitForNextUpdate();
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].networkStatus).toBe(NetworkStatus.error);
      expect(result.current[1].data).toBeUndefined();
      expect(result.current[1].error!.message).toBe("from the network");

      await expect(waitForNextUpdate({
        timeout: 20,
      })).rejects.toThrow('Timed out');
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

      const { result, waitForNextUpdate } = renderHook(
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

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.called).toBe(false);
      expect(result.current.query.data).toBeUndefined();

      await expect(waitForNextUpdate({
        timeout: 20,
      })).rejects.toThrow('Timed out');

      const execPromise = result.current.exec().then(result => {
        expect(result.loading).toBe(false);
        expect(result.called).toBe(true);
        expect(result.data).toEqual({ counter: 1 });
      });

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.called).toBe(true);
      expect(result.current.query.data).toBeUndefined();
      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.called).toBe(true);
      expect(result.current.query.data).toEqual({ counter: 1 });

      await expect(waitForNextUpdate({
        timeout: 20,
      })).rejects.toThrow('Timed out');

      await execPromise;

      const { options } = result.current.query.observable;
      expect(options.fetchPolicy).toBe(defaultFetchPolicy);
    });
  })
});
