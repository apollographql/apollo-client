import React from 'react';
import gql from 'graphql-tag';
import { renderHook } from '@testing-library/react-hooks';

import { ApolloClient, InMemoryCache } from '../../../core';
import { ApolloProvider } from '../../../react';
import { MockedProvider, mockSingleLink } from '../../../testing';
import { useLazyQuery } from '../useLazyQuery';

describe('useLazyQuery Hook', () => {
  it('should hold query execution until manually triggered', async () => {
    const query = gql`{ hello }`;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world' } },
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
    setTimeout(() => execute());

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({ hello: 'world' });
  });

  it('should set `called` to false by default', async () => {
    const query = gql`{ hello }`;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world' } },
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
    expect(result.current[1].called).toBe(false);
  });

  it('should set `called` to true after calling the lazy execute function', async () => {
    const query = gql`{ hello }`;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world' } },
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
    const query = gql`{ hello }`;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world' } },
        delay: 20,
      },
    ];

    const { result, waitForNextUpdate } = renderHook(
      // skip isn’t actually an option on the types
      () => useLazyQuery(query, { skip: true } as any),
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

  it('should fetch data each time the execution function is called, when using a "network-only" fetch policy', async () => {
    const query = gql`{ hello }`;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world 1' } },
        delay: 20,
      },
      {
        request: { query },
        result: { data: { hello: 'world 2' } },
        delay: 20,
      },
    ];

    const { result, waitForNextUpdate } = renderHook(
      () => useLazyQuery(query, {
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
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({ hello: 'world 1' });

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({ hello: 'world 2' });
  });

  it('should persist previous data when a query is re-run', async () => {
    const query = gql`{ hello }`;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world 1' } },
        delay: 20,
      },
      {
        request: { query },
        result: { data: { hello: 'world 2' } },
        delay: 20,
      },
    ];

    const { result, waitForNextUpdate } = renderHook(
      () => useLazyQuery(query, {
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
    const query = gql`{ hello }`;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: "world 1" } },
        delay: 10,
      },
      {
        request: { query },
        result: { data: { hello: "world 2" } },
      },
      {
        request: { query },
        result: { data: { hello: "world 3" } },
      },
    ];

    const wrapper = ({ children }: any) => (
      <MockedProvider mocks={mocks}>{children}</MockedProvider>
    );

    const { result, waitForNextUpdate } = renderHook(
      () => useLazyQuery(query),
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
    const query = gql`{ hello }`;

    const cache = new InMemoryCache();
    const link = mockSingleLink(
      {
        request: { query },
        result: { data: { hello: 'from link' } },
        delay: 20,
      },
    );

    const client = new ApolloClient({
      link,
      cache,
    });

    cache.writeQuery({ query, data: { hello: 'from cache' }});

    const { result, waitForNextUpdate } = renderHook(
      () => useLazyQuery(query, { fetchPolicy: 'cache-and-network' }),
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
    const query = gql`{ hello }`;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world' } },
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
    const mock = jest.fn();
    setTimeout(() => mock(execute()));

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(true);

    await waitForNextUpdate();
    expect(result.current[1].loading).toBe(false);
    expect(result.current[1].data).toEqual({ hello: 'world' });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBeInstanceOf(Promise);
    expect(await mock.mock.calls[0][0]).toEqual(result.current[1]);
  });
});
