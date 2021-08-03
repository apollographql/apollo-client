import React, { Fragment } from 'react';
import { DocumentNode, GraphQLError } from 'graphql';
import gql from 'graphql-tag';
import { act } from 'react-dom/test-utils';
import { render, wait } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import {
  ApolloClient,
  ApolloError,
  NetworkStatus,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from '../../../core';
import { InMemoryCache } from '../../../cache';
import { ApolloProvider } from '../../context';
import { Observable, Reference, concatPagination } from '../../../utilities';
import { ApolloLink } from '../../../link/core';
import { itAsync, MockLink, MockedProvider, mockSingleLink } from '../../../testing';
import { useQuery } from '../useQuery';
import { useMutation } from '../useMutation';

describe('useQuery Hook', () => {
  describe('General use', () => {
    it('should handle a simple query', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world" });
    });

    it('should read and write results from the cache', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        () => useQuery(query),
        { wrapper }
      );
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world" });

      rerender();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world" });
    });

    it('should preserve functions between renders', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query),
        { wrapper },
      );
      expect(result.current.loading).toBe(true);
      const {
        refetch,
        fetchMore,
        startPolling,
        stopPolling,
        subscribeToMore,
      } = result.current;
      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(refetch).toBe(result.current.refetch);
      expect(fetchMore).toBe(result.current.fetchMore);
      expect(startPolling).toBe(result.current.startPolling);
      expect(stopPolling).toBe(result.current.stopPolling);
      expect(subscribeToMore).toBe(result.current.subscribeToMore);
    });

    it('should set called to true by default', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.called).toBe(true);
    });

    it('should work with variables', async () => {
      const query = gql`
        query ($id: Int) {
          hello(id: $id)
        }
      `;

      const mocks = [
        {
          request: { query, variables: { id: 1 } },
          result: { data: { hello: "world 1" } },
        },
        {
          request: { query, variables: { id: 2 } },
          result: { data: { hello: "world 2" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ id }) => useQuery(query, { variables: { id }}),
        { wrapper, initialProps: { id: 1 } },
      );
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });

      rerender({ id: 2 });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 2" });
    });

    it('should return the same results for the same variables', async () => {
      const query = gql`
        query ($id: Int) {
          hello(id: $id)
        }
      `;

      const mocks = [
        {
          request: { query, variables: { id: 1 } },
          result: { data: { hello: "world 1" } },
        },
        {
          request: { query, variables: { id: 2 } },
          result: { data: { hello: "world 2" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ id }) => useQuery(query, { variables: { id } }),
        { wrapper, initialProps: { id: 1 } },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });


      rerender({ id: 2 });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 2" });

      rerender({ id: 2 });
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 2" });
    });

    it('should work with variables 2', async () => {
      const query = gql`
        query ($name: String) {
          names(name: $name)
        }
      `;

      const mocks = [
        {
          request: { query, variables: { name: "" } },
          result: { data: { names: ["Alice", "Bob", "Eve"] } },
        },
        {
          request: { query, variables: { name: "z" } },
          result: { data: { names: [] } },
        },
        {
          request: { query, variables: { name: "zz" } },
          result: { data: { names: [] } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ name }) => useQuery(query, { variables: { name } }),
        { wrapper, initialProps: { name: "" } },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ names: ["Alice", "Bob", "Eve"] });

      rerender({ name: 'z' });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ names: [] });

      rerender({ name: 'zz' });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ names: [] });
    });

    // TODO: Rewrite this test
    itAsync('should not error when forcing an update with React >= 16.13.0', (resolve, reject) => {
      const CAR_QUERY: DocumentNode = gql`
        query {
          cars {
            make
            model
            vin
          }
        }
      `;

      const CAR_RESULT_DATA = {
        cars: [
          {
            make: 'Audi',
            model: 'RS8',
            vin: 'DOLLADOLLABILL',
            __typename: 'Car'
          }
        ]
      };
      let wasUpdateErrorLogged = false;
      const consoleError = console.error;
      console.error = (msg: string) => {
        console.log(msg);
        wasUpdateErrorLogged = msg.indexOf('Cannot update a component') > -1;
      };

      const CAR_MOCKS = [1, 2, 3, 4, 5, 6].map(something => ({
        request: {
          query: CAR_QUERY,
          variables: { something }
        },
        result: { data: CAR_RESULT_DATA },
        delay: 1000
      }));

      let renderCount = 0;

      const InnerComponent = ({ something }: any) => {
        const { loading, data } = useQuery(CAR_QUERY, {
          fetchPolicy: 'network-only',
          variables: { something }
        });
        renderCount += 1;
        if (loading) return null;
        expect(wasUpdateErrorLogged).toBeFalsy();
        expect(data).toEqual(CAR_RESULT_DATA);
        return null;
      };

      function WrapperComponent({ something }: any) {
        const { loading } = useQuery(CAR_QUERY, {
          variables: { something }
        });
        return loading ? null : <InnerComponent something={something + 1} />;
      }

      render(
        <MockedProvider link={new MockLink(CAR_MOCKS).setOnError(reject)}>
          <Fragment>
            <WrapperComponent something={1} />
            <WrapperComponent something={3} />
            <WrapperComponent something={5} />
          </Fragment>
        </MockedProvider>
      );

      wait(() => {
        expect(renderCount).toBe(3);
      }).finally(() => {
        console.error = consoleError;
      }).then(resolve, reject);
    });

    it('should tear down the query on unmount', async () => {
      const query = gql`{ hello }`;
      const client = new ApolloClient({
        link: new ApolloLink(() => Observable.of({ data: { hello: 'world' } })),
        cache: new InMemoryCache(),
      });

      const wrapper = ({ children }: any) => (
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
      );

      const { unmount } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(client.getObservableQueries().size).toBe(1);
      unmount();
      expect(client.getObservableQueries().size).toBe(0);
    });

    it('should work with ssr: false', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { ssr: false }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world" });
    });
  });

  describe('polling', () => {
    it('should support polling', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world 1" } },
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

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { pollInterval: 10 }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 2" });

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 3" });

      result.current.stopPolling();
      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
    });

    it('should start polling when skip goes from true to false', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world 1" } },
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

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ skip }) => useQuery(query, { pollInterval: 10, skip }),
        { wrapper, initialProps: { skip: undefined } as any },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });

      rerender({ skip: true });
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);

      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');

      rerender({ skip: false });
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 2" });

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 3" });
    });

    it('should stop polling when component unmounts', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world 1" } },
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

      const cache = new InMemoryCache();

      const link = new MockLink(mocks);
      const requestSpy = jest.spyOn(link, 'request');
      const onErrorFn = jest.fn();
      link.setOnError(onErrorFn);
      const wrapper = ({ children }: any) => (
        <MockedProvider link={link} cache={cache}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate, unmount } = renderHook(
        () => useQuery(query, { pollInterval: 10 }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });

      unmount();
      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(onErrorFn).toHaveBeenCalledTimes(0);
    });

    it('should stop polling when component is unmounted in Strict Mode', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world 1" } },
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

      const cache = new InMemoryCache();
      const link = new MockLink(mocks);
      const requestSpy = jest.spyOn(link, 'request');
      const onErrorFn = jest.fn();
      link.setOnError(onErrorFn);
      const wrapper = ({ children }: any) => (
        <React.StrictMode>
          <MockedProvider link={link} cache={cache}>{children}</MockedProvider>
        </React.StrictMode>
      );

      const { result, waitForNextUpdate, unmount } = renderHook(
        () => useQuery(query, { pollInterval: 10 }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });

      unmount();

      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(onErrorFn).toHaveBeenCalledTimes(0);
    });

    it('should start and stop polling in Strict Mode', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world 1" } },
        },
        {
          request: { query },
          result: { data: { hello: "world 2" } },
        },
      ];

      const cache = new InMemoryCache();
      const link = new MockLink(mocks);
      const requestSpy = jest.spyOn(link, 'request');
      const onErrorFn = jest.fn();
      link.setOnError(onErrorFn);
      const wrapper = ({ children }: any) => (
        <React.StrictMode>
          <MockedProvider link={link} cache={cache}>{children}</MockedProvider>
        </React.StrictMode>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { pollInterval: 20 }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });

      result.current.stopPolling();
      const nextUpdate = waitForNextUpdate();
      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
      result.current.startPolling(20);

      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(onErrorFn).toHaveBeenCalledTimes(0);
      await nextUpdate;

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 2" });
      expect(requestSpy).toHaveBeenCalledTimes(2);
      expect(onErrorFn).toHaveBeenCalledTimes(0);
    });

    it('should not throw an error if stopPolling is called manually', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: 'world' },
          }
        }
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate, unmount } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });

      unmount();
      result.current.stopPolling();
    });
  });

  describe('Error handling', () => {
    it('should pass along GraphQL errors', async () => {
      const query = gql`
        query TestQuery {
          rates(currency: "USD") {
            rate
          }
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('error')]
          }
        }
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');
    });

    it('should only call onError callbacks once', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('error')],
          },
        },
        {
          request: { query },
          result: {
            data: { hello: 'world' },
          },
          delay: 10,
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, {
          onError,
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      await new Promise((resolve) => setTimeout(resolve));
      expect(onError).toHaveBeenCalledTimes(1);

      result.current.refetch();
      await waitForNextUpdate();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('should persist errors on re-render if they are still valid', async () => {
      const query = gql`{ hello }`;

      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('error')]
          }
        }
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      rerender();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
    });

    it('should persist errors on re-render with inline onError/onCompleted callbacks',  async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('error')]
          }
        }
      ];

      const cache = new InMemoryCache();
      const link = new MockLink(mocks);
      const onErrorFn = jest.fn();
      link.setOnError(onErrorFn);
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} link={link} cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        () => useQuery(query, { onError: () => {}, onCompleted: () => {} }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      rerender();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      expect(onErrorFn).toHaveBeenCalledTimes(0);
      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
    });

    it('should render multiple errors when refetching', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('error 1')]
          }
        },
        {
          request: { query },
          result: {
            errors: [new GraphQLError('error 2')]
          },
          delay: 10,
        }
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error 1');

      const catchFn = jest.fn();

      result.current.refetch().catch(catchFn);
      await waitForNextUpdate();
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error 2');

      expect(catchFn.mock.calls.length).toBe(1);
      expect(catchFn.mock.calls[0].length).toBe(1);
      expect(catchFn.mock.calls[0][0]).toBeInstanceOf(ApolloError);
      expect(catchFn.mock.calls[0][0].message).toBe('error 2');
    });

    it('should render the same error on refetch', async () => {
      const query = gql`{ hello }`;

      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('same error')]
          }
        },
        {
          request: { query },
          result: {
            errors: [new GraphQLError('same error')]
          }
        }
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('same error');


      const catchFn = jest.fn();
      await act(async () => {
        await result.current.refetch().catch(catchFn);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('same error');

      expect(catchFn.mock.calls.length).toBe(1);
      expect(catchFn.mock.calls[0].length).toBe(1);
      expect(catchFn.mock.calls[0][0]).toBeInstanceOf(ApolloError);
      expect(catchFn.mock.calls[0][0].message).toBe('same error');
    });

    it('should render data and errors with refetch', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('same error')],
          },
        },
        {
          request: { query },
          result: {
            data: { hello: 'world' },
          },
          delay: 10,
        },
        {
          request: { query },
          result: {
            errors: [new GraphQLError('same error')],
          },
          delay: 10,
        }
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('same error');

      result.current.refetch();

      await waitForNextUpdate();
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(result.current.error).toBe(undefined);

      const catchFn = jest.fn();
      result.current.refetch().catch(catchFn);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(result.current.error).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      // TODO: Is this correct behavior here?
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('same error');

      expect(catchFn.mock.calls.length).toBe(1);
      expect(catchFn.mock.calls[0].length).toBe(1);
      expect(catchFn.mock.calls[0][0]).toBeInstanceOf(ApolloError);
      expect(catchFn.mock.calls[0][0].message).toBe('same error');
    });
  });

  describe('Pagination', () => {
    const query = gql`
      query letters($limit: Int) {
        letters(limit: $limit) {
          name
          position
        }
      }
    `;

    const ab = [
      { name: 'A', position: 1 },
      { name: 'B', position: 2 },
    ];

    const cd = [
      { name: 'C', position: 3 },
      { name: 'D', position: 4 },
    ];

    const mocks = [
      {
        request: { query, variables: { limit: 2 } },
        result: {
          data: {
            letters: ab,
          },
        },
      },
      {
        request: { query, variables: { limit: 2 } },
        result: {
          data: {
            letters: cd,
          },
        },
        delay: 10,
      },
    ];

    it('should fetchMore with updateQuery', async () => {
      // TODO: Calling fetchMore with an updateQuery callback is deprecated
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { variables: { limit: 2 } }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab });
      result.current.fetchMore({
        variables: { limit: 2 },
        updateQuery: (prev, { fetchMoreResult }) => ({
          letters: prev.letters.concat(fetchMoreResult.letters),
        }),
      });

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab.concat(cd) });

      warnSpy.mockRestore();
    });

    it('should fetchMore with updateQuery and notifyOnNetworkStatusChange', async () => {
      // TODO: Calling fetchMore with an updateQuery callback is deprecated
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, {
          variables: { limit: 2 },
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab });

      result.current.fetchMore({
        variables: { limit: 2 },
        updateQuery: (prev, { fetchMoreResult }) => ({
          letters: prev.letters.concat(fetchMoreResult.letters),
        }),
      });

      await waitForNextUpdate();
      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.fetchMore);
      expect(result.current.data).toEqual({ letters: ab });

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab.concat(cd) });

      warnSpy.mockRestore();
    });

    it('fetchMore with concatPagination', async () => {
      const cache = new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              letters: concatPagination(),
            },
          },
        },
      });

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { variables: { limit: 2 } }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab });
      result.current.fetchMore({ variables: { limit: 2 } });

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab.concat(cd) });
    });

    it('fetchMore with concatPagnination and notifyOnNetworkStatusChange', async () => {
      const cache = new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              letters: concatPagination(),
            },
          },
        },
      });

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, {
          variables: { limit: 2 },
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab });

      result.current.fetchMore({ variables: { limit: 2 } });

      await waitForNextUpdate();
      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.fetchMore);
      expect(result.current.data).toEqual({ letters: ab });

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab.concat(cd) });
    });
  });

  describe('Refetching', () => {
    it('refetching with different variables', async () => {
      const query = gql`
        query ($id: Int) {
          hello(id: $id)
        }
      `;

      const mocks = [
        {
          request: { query, variables: { id: 1 } },
          result: { data: { hello: 'world 1' } },
        },
        {
          request: { query, variables: { id: 2 } },
          result: { data: { hello: 'world 2' } },
          delay: 10,
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, {
          variables: { id: 1 },
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world 1' });

      result.current.refetch({ id: 2 });
      await waitForNextUpdate();
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world 2' });
    });

    describe('refetchWritePolicy', () => {
      const query = gql`
        query GetPrimes ($min: number, $max: number) {
          primes(min: $min, max: $max)
        }
      `;

      const mocks = [
        {
          request: {
            query,
            variables: { min: 0, max: 12 },
          },
          result: {
            data: {
              primes: [2, 3, 5, 7, 11],
            }
          }
        },
        {
          request: {
            query,
            variables: { min: 12, max: 30 },
          },
          result: {
            data: {
              primes: [13, 17, 19, 23, 29],
            }
          },
          delay: 10,
        },
      ];

      it('should support explicit "overwrite"', async () => {
        const mergeParams: [any, any][] = [];
        const cache = new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                primes: {
                  keyArgs: false,
                  merge(existing, incoming) {
                    mergeParams.push([existing, incoming]);
                    return existing ? existing.concat(incoming) : incoming;
                  },
                },
              },
            },
          },
        });

        const wrapper = ({ children }: any) => (
          <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
        );

        const { result, waitForNextUpdate } = renderHook(
          () => useQuery(query, {
            variables: { min: 0, max: 12 },
            notifyOnNetworkStatusChange: true,
            // This is the key line in this test.
            refetchWritePolicy: 'overwrite',
          }),
          { wrapper },
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toBe(undefined);
        expect(typeof result.current.refetch).toBe('function');

        await waitForNextUpdate();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeUndefined();
        expect(result.current.data).toEqual({ primes: [2, 3, 5, 7, 11] });
        expect(mergeParams).toEqual([
          [void 0, [2, 3, 5, 7, 11]],
        ]);


        const thenFn = jest.fn();
        result.current.refetch({ min: 12, max: 30 }).then(thenFn);

        await waitForNextUpdate();
        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toEqual({
          // We get the stale data because we configured keyArgs: false.
          primes: [2, 3, 5, 7, 11],
        });

        // This networkStatus is setVariables instead of refetch because we
        // called refetch with new variables.
        expect(result.current.networkStatus).toBe(NetworkStatus.setVariables);

        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toEqual({ primes: [13, 17, 19, 23, 29] });
        expect(mergeParams).toEqual([
          [undefined, [2, 3, 5, 7, 11]],
          // Without refetchWritePolicy: "overwrite", this array will be
          // all 10 primes (2 through 29) together.
          [undefined, [13, 17, 19, 23, 29]],
        ]);

        expect(thenFn).toHaveBeenCalledTimes(1);
        expect(thenFn).toHaveBeenCalledWith({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: { primes: [13, 17, 19, 23, 29] },
        });
      });

      it('should support explicit "merge"', async () => {
        const mergeParams: [any, any][] = [];
        const cache = new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                primes: {
                  keyArgs: false,
                  merge(existing, incoming) {
                    mergeParams.push([existing, incoming]);
                    return existing ? [...existing, ...incoming] : incoming;
                  },
                },
              },
            },
          },
        });

        const wrapper = ({ children }: any) => (
          <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
        );

        const { result, waitForNextUpdate } = renderHook(
          () => useQuery(query, {
            variables: { min: 0, max: 12 },
            notifyOnNetworkStatusChange: true,
            // This is the key line in this test.
            refetchWritePolicy: 'merge',
          }),
          { wrapper },
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toBe(undefined);
        expect(typeof result.current.refetch).toBe('function');

        await waitForNextUpdate();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeUndefined();
        expect(result.current.data).toEqual({ primes: [2, 3, 5, 7, 11] });
        expect(mergeParams).toEqual([
          [undefined, [2, 3, 5, 7, 11]],
        ]);


        const thenFn = jest.fn();
        result.current.refetch({ min: 12, max: 30 }).then(thenFn);

        await waitForNextUpdate();
        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toEqual({
          // We get the stale data because we configured keyArgs: false.
          primes: [2, 3, 5, 7, 11],
        });
        // This networkStatus is setVariables instead of refetch because we
        // called refetch with new variables.
        expect(result.current.networkStatus).toBe(NetworkStatus.setVariables);
        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toEqual({
          primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29],
        });
        expect(mergeParams).toEqual([
          [void 0, [2, 3, 5, 7, 11]],
          // This indicates concatenation happened.
          [[2, 3, 5, 7, 11], [13, 17, 19, 23, 29]],
        ]);
        expect(mergeParams).toEqual([
          [undefined, [2, 3, 5, 7, 11]],
          // Without refetchWritePolicy: "overwrite", this array will be
          // all 10 primes (2 through 29) together.
          [[2, 3, 5, 7, 11], [13, 17, 19, 23, 29]],
        ]);

        expect(thenFn).toHaveBeenCalledTimes(1);
        expect(thenFn).toHaveBeenCalledWith({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
        });
      });

      it('should assume default refetchWritePolicy value is "overwrite"', async () => {
        const mergeParams: [any, any][] = [];
        const cache = new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                primes: {
                  keyArgs: false,
                  merge(existing, incoming) {
                    mergeParams.push([existing, incoming]);
                    return existing ? existing.concat(incoming) : incoming;
                  },
                },
              },
            },
          },
        });

        const wrapper = ({ children }: any) => (
          <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
        );

        const { result, waitForNextUpdate } = renderHook(
          () => useQuery(query, {
            variables: { min: 0, max: 12 },
            notifyOnNetworkStatusChange: true,
            // Intentionally not passing refetchWritePolicy.
          }),
          { wrapper },
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toBe(undefined);
        expect(typeof result.current.refetch).toBe('function');

        await waitForNextUpdate();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeUndefined();
        expect(result.current.data).toEqual({ primes: [2, 3, 5, 7, 11] });
        expect(mergeParams).toEqual([
          [void 0, [2, 3, 5, 7, 11]],
        ]);


        const thenFn = jest.fn();
        result.current.refetch({ min: 12, max: 30 }).then(thenFn);

        await waitForNextUpdate();
        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toEqual({
          // We get the stale data because we configured keyArgs: false.
          primes: [2, 3, 5, 7, 11],
        });

        // This networkStatus is setVariables instead of refetch because we
        // called refetch with new variables.
        expect(result.current.networkStatus).toBe(NetworkStatus.setVariables);

        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toEqual({ primes: [13, 17, 19, 23, 29] });
        expect(mergeParams).toEqual([
          [undefined, [2, 3, 5, 7, 11]],
          // Without refetchWritePolicy: "overwrite", this array will be
          // all 10 primes (2 through 29) together.
          [undefined, [13, 17, 19, 23, 29]],
        ]);

        expect(thenFn).toHaveBeenCalledTimes(1);
        expect(thenFn).toHaveBeenCalledWith({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: { primes: [13, 17, 19, 23, 29] },
        });
      });
    });
  });

  describe('Callbacks', () => {
    it('onCompleted is called once with cached data', async () => {
      const query = gql`{ hello }`;

      const cache = new InMemoryCache();
      cache.writeQuery({
        query,
        data: { hello: 'world' },
      });

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={[]} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onCompleted = jest.fn();
      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, {
          fetchPolicy: 'cache-only',
          onCompleted,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith({ hello: 'world' });
      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    it('onCompleted is called once despite state changes', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: 'world' } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onCompleted = jest.fn();
      const { result, rerender, waitForNextUpdate } = renderHook(
        () => useQuery(query, {
          onCompleted,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith({ hello: 'world' });

      rerender();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith({ hello: 'world' });
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    it('should not call onCompleted if skip is true', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: 'world' } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onCompleted = jest.fn();
      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, {
          skip: true,
          onCompleted,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);

      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
      expect(onCompleted).toHaveBeenCalledTimes(0);
    });

    it('should not make extra network requests when `onCompleted` is defined with a `network-only` fetch policy', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: 'world' } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onCompleted = jest.fn();
      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, {
          fetchPolicy: 'network-only',
          onCompleted,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(onCompleted).toHaveBeenCalledTimes(1);

      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });
  });

  describe('Optimistic data', () => {
    it('should display rolled back optimistic data when an error occurs', async () => {
      const query = gql`
        query AllCars {
          cars {
            id
            make
            model
          }
        }
      `;

      const carsData = {
        cars: [
          {
            id: 1,
            make: 'Audi',
            model: 'RS8',
            __typename: 'Car'
          }
        ]
      };

      const mutation = gql`
        mutation AddCar {
          addCar {
            id
            make
            model
          }
        }
      `;

      const carData = {
        id: 2,
        make: 'Ford',
        model: 'Pinto',
        __typename: 'Car'
      };

      const allCarsData = {
        cars: [
          carsData.cars[0],
          carData
        ]
      };

      const mocks = [
        {
          request: { query },
          result: { data: carsData },
        },
        {
          request: { query: mutation },
          error: new Error('Oh no!'),
          delay: 10,
        }
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      const { result, waitForNextUpdate } = renderHook(
        () => ({
          mutation: useMutation(mutation, {
            optimisticResponse: { addCar: carData },
            update(cache, { data }) {
              cache.modify({
                fields: {
                  cars(existing, { readField }) {
                    const newCarRef = cache.writeFragment({
                      data: data!.addCar,
                      fragment: gql`fragment NewCar on Car {
                        id
                        make
                        model
                      }`,
                    });

                    if (existing.some(
                      (ref: Reference) => readField('id', ref) === data!.addCar.id
                    )) {
                      return existing;
                    }

                    return [...existing, newCarRef];
                  },
                },
              });
            },
            onError,
          }),
          query: useQuery(query),
        }),
        { wrapper },
      );

      expect(result.current.query.loading).toBe(true);
      const mutate = result.current.mutation[0];

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(carsData);

      act(() => void mutate());
      // The mutation ran and is loading the result. The query stays at not
      // loading as nothing has changed for the query.
      expect(result.current.mutation[1].loading).toBe(true);
      expect(result.current.query.loading).toBe(false);

      await waitForNextUpdate();
      // There is a missing update here because mutation and query update in
      // the same microtask loop.
      const previous = result.all[result.all.length - 2];
      if (previous instanceof Error) {
        throw previous;
      }

      // The mutation ran and is loading the result. The query stays at
      // not loading as nothing has changed for the query.
      expect(previous.mutation[1].loading).toBe(true);
      expect(previous.query.loading).toBe(false);

      // The first part of the mutation has completed using the defined
      // optimisticResponse data. This means that while the mutation stays in a
      // loading state, it has made its optimistic data available to the query.
      // New optimistic data doesn't trigger a query loading state.
      expect(result.current.mutation[1].loading).toBe(true);
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(allCarsData);

      await waitForNextUpdate();
      // The mutation has completely finished, leaving the query with access to
      // the original cache data.
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(carsData);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toBe('Oh no!');
    });
  });

  describe('Partial refetching', () => {
    it('should attempt a refetch when the query result was marked as being ' +
       'partial, the returned data was reset to an empty Object by the ' +
       'Apollo Client QueryManager (due to a cache miss), and the ' +
       '`partialRefetch` prop is `true`', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const query: DocumentNode = gql`
        query AllPeople($name: String!) {
          allPeople(name: $name) {
            people {
              name
            }
          }
        }
      `;

      interface Data {
        allPeople: {
          people: Array<{ name: string }>;
        };
      }

      const peopleData: Data = {
        allPeople: { people: [{ name: 'Luke Skywalker' }] }
      };

      const link = mockSingleLink(
        {
          request: {
            query,
            variables: {
              someVar: 'abc123'
            }
          },
          result: { data: undefined },
        },
        {
          request: {
            query,
            variables: {
              someVar: 'abc123'
            }
          },
          result: { data: peopleData },
          delay: 10,
        }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const wrapper = ({ children }: any) => (
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, {
          variables: { someVar: 'abc123' },
          partialRefetch: true,
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      // Initial loading render
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);

      await waitForNextUpdate();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatch('Missing field');
      const previous = result.all[result.all.length - 2];
      if (previous instanceof Error) {
        throw previous;
      }

      // `data` is missing and `partialRetch` is true, so a refetch
      // is triggered and loading is set as true again
      expect(previous.loading).toBe(true);
      expect(previous.data).toBe(undefined);
      expect(previous.networkStatus).toBe(NetworkStatus.loading);

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.networkStatus).toBe(NetworkStatus.refetch);

      await waitForNextUpdate();
      // Refetch has completed
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(peopleData);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);

      errorSpy.mockRestore();
    });
  });

  describe('Client Resolvers', () => {
    it('should receive up to date @client(always: true) fields on entity update', async () => {
      const query = gql`
        query GetClientData($id: ID) {
          clientEntity(id: $id) @client(always: true) {
            id
            title
            titleLength @client(always: true)
          }
        }
      `;

      const mutation = gql`
        mutation AddOrUpdate {
          addOrUpdate(id: $id, title: $title) @client
        }
      `;

      const fragment = gql`
        fragment ClientDataFragment on ClientData {
          id
          title
        }
      `;

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(() => Observable.of({ data: {} })),
        resolvers: {
          ClientData: {
            titleLength(data) {
              return data.title.length
            }
          },
          Query: {
            clientEntity(_root, {id}, {cache}) {
              return cache.readFragment({
                id: cache.identify({id, __typename: "ClientData"}),
                fragment,
              });
            },
          },
          Mutation: {
            addOrUpdate(_root, {id, title}, {cache}) {
              return cache.writeFragment({
                id: cache.identify({id, __typename: "ClientData"}),
                fragment,
                data: {id, title, __typename: "ClientData"},
              });
            },
          },
        },
      });

      const entityId = 1;
      const shortTitle = 'Short';
      const longerTitle = 'A little longer';
      client.mutate({
        mutation,
        variables: {
          id: entityId,
          title: shortTitle,
        },
      });

      const wrapper = ({ children }: any) => (
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { variables: { id: entityId } }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({
        clientEntity: {
          id: entityId,
          title: shortTitle,
          titleLength: shortTitle.length,
          __typename: 'ClientData',
        },
      });

      setTimeout(() => {
        client.mutate({
          mutation,
          variables: {
            id: entityId,
            title: longerTitle,
          }
        });
      });

      await waitForNextUpdate();
      expect(result.current.data).toEqual({
        clientEntity: {
          id: entityId,
          title: longerTitle,
          titleLength: longerTitle.length,
          __typename: "ClientData",
        },
      });
    });
  });

  describe('Skipping', () => {
    const query = gql`query greeting($someVar: Boolean) { hello }`;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world' } },
      },
      {
        request: {
          query,
          variables: { someVar: true },
        },
        result: { data: { hello: 'world' } },
      },
    ];

    it('should skip running a query when `skip` is `true`', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: 'world' } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ skip }) => useQuery(query, { skip }),
        { wrapper, initialProps: { skip: true }  },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');

      rerender({ skip: false });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBeFalsy();
      expect(result.current.data).toEqual({ hello: 'world' });
    });

    it('should not make network requests when `skip` is `true`', async () => {
      const linkFn = jest.fn();
      const link = new ApolloLink((o, f) => {
        linkFn();
        return f ? f(o) : null;
      }).concat(mockSingleLink(...mocks));
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const wrapper = ({ children }: any) => (
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ skip, variables }) => useQuery(query, { skip, variables }),
        { wrapper, initialProps: { skip: false, variables: undefined as any } },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });

      rerender({ skip: true, variables: { someVar: true } });
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(linkFn).toHaveBeenCalledTimes(1);
    });

    it('should tear down the query if `skip` is `true`', async () => {
      const client = new ApolloClient({
        link: new ApolloLink(() => Observable.of({ data: { hello: 'world' } })),
        cache: new InMemoryCache(),
      });

      const wrapper = ({ children }: any) => (
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
      );

      const { unmount } = renderHook(
        () => useQuery(query, { skip: true }),
        { wrapper },
      );

      expect(client.getObservableQueries().size).toBe(0);
      unmount();
      expect(client.getObservableQueries().size).toBe(0);
    });
  });

  describe('Missing Fields', () => {
    it('should have errors populated with missing field errors from the cache', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const carQuery: DocumentNode = gql`
        query cars($id: Int) {
          cars(id: $id) {
            id
            make
            model
            vin
            __typename
          }
        }
      `;

      const carData = {
        cars: [
          {
            id: 1,
            make: 'Audi',
            model: 'RS8',
            vine: 'DOLLADOLLABILL',
            __typename: 'Car'
          }
        ]
      };

      const mocks = [
        {
          request: { query: carQuery, variables: { id: 1 } },
          result: { data: carData }
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(carQuery, { variables: { id: 1 } }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);
      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.clientErrors.length).toEqual(1);
      expect(result.current.error!.message).toMatch(/Can't find field 'vin' on Car:1/);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatch('Missing field');
      errorSpy.mockRestore();
    });
  });

  describe('Previous data', () => {
    it('should persist previous data when a query is re-run', async () => {
      const query = gql`
        query car {
          car {
            id
            make
          }
        }
      `;

      const data1 = {
        car: {
          id: 1,
          make: 'Venturi',
          __typename: 'Car',
        }
      };

      const data2 = {
        car: {
          id: 2,
          make: 'Wiesmann',
          __typename: 'Car',
        }
      };

      const mocks = [
        { request: { query }, result: { data: data1 } },
        { request: { query }, result: { data: data2 }, delay: 10 },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.previousData).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toBe(undefined);

      setTimeout(() => result.current.refetch());
      await waitForNextUpdate();
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toEqual(data1);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(data2);
      expect(result.current.previousData).toEqual(data1);
    });

    it('should persist result.previousData across multiple results', async () => {
      const query: TypedDocumentNode<{
        car: {
          id: string;
          make: string;
        };
      }, {
        vin?: string;
      }> = gql`
        query car($vin: String) {
          car(vin: $vin) {
            id
            make
          }
        }
      `;

      const data1 = {
        car: {
          id: 1,
          make: 'Venturi',
          __typename: 'Car',
        },
      };

      const data2 = {
        car: {
          id: 2,
          make: 'Wiesmann',
          __typename: 'Car',
        },
      };

      const data3 = {
        car: {
          id: 3,
          make: 'Beetle',
          __typename: 'Car',
        },
      };

      const mocks = [
        { request: { query }, result: { data: data1 } },
        { request: { query }, result: { data: data2 }, delay: 100 },
        {
          request: {
            query,
            variables: { vin: "ABCDEFG0123456789" },
          },
          result: { data: data3 },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.previousData).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toBe(undefined);

      setTimeout(() => result.current.refetch());
      await waitForNextUpdate();
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toEqual(data1);

      result.current.refetch({ vin: "ABCDEFG0123456789" });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toEqual(data1);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(data3);
      expect(result.current.previousData).toEqual(data1);
    });

    it("should be cleared when variables change causes cache miss", async () => {
      const peopleData = [
        { id: 1, name: 'John Smith', gender: 'male' },
        { id: 2, name: 'Sara Smith', gender: 'female' },
        { id: 3, name: 'Budd Deey', gender: 'nonbinary' },
        { id: 4, name: 'Johnny Appleseed', gender: 'male' },
        { id: 5, name: 'Ada Lovelace', gender: 'female' },
      ];

      const link = new ApolloLink(operation => {
        return new Observable(observer => {
          const { gender } = operation.variables;
          new Promise(resolve => setTimeout(resolve, 300)).then(() => {
            observer.next({
              data: {
                people: gender === "all" ? peopleData :
                  gender ? peopleData.filter(
                    person => person.gender === gender
                  ) : peopleData,
              }
            });
            observer.complete();
          });
        });
      });

      type Person = {
        __typename: string;
        id: string;
        name: string;
      };

      const query: TypedDocumentNode<{
        people: Person[];
      }> = gql`
        query AllPeople($gender: String!) {
          people(gender: $gender) {
            id
            name
          }
        }
      `;

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider link={link} cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ gender }) => useQuery(query, {
          variables: { gender },
          fetchPolicy: 'network-only',
        }),
        { wrapper, initialProps: { gender: 'all' } },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);
      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({
        people: peopleData.map(({ gender, ...person }) => person),
      });

      rerender({ gender: 'female' });
      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.setVariables);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({
        people: peopleData
          .filter((person) => person.gender === 'female')
          .map(({ gender, ...person }) => person),
      });

      rerender({ gender: 'nonbinary' });
      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.setVariables);
      expect(result.current.data).toBe(undefined);
      await waitForNextUpdate();

      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({
        people: peopleData
          .filter((person) => person.gender === 'nonbinary')
          .map(({ gender, ...person }) => person),
      });
    });
  });

  describe('canonical cache results', () => {
    it('can be disabled via useQuery options', async () => {
      const cache = new InMemoryCache({
        typePolicies: {
          Result: {
            keyFields: false,
          },
        },
      });

      const query = gql`
        query {
          results {
            value
          }
        }
      `;

      const results = [
        { __typename: "Result", value: 0 },
        { __typename: "Result", value: 1 },
        { __typename: "Result", value: 1 },
        { __typename: "Result", value: 2 },
        { __typename: "Result", value: 3 },
        { __typename: "Result", value: 5 },
      ];

      cache.writeQuery({
        query,
        data: { results },
      })

      const wrapper = ({ children }: any) => (
        <MockedProvider cache={cache}>
          {children}
        </MockedProvider>
      );

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ canonizeResults }) => useQuery(query, {
          fetchPolicy: 'cache-only',
          canonizeResults,
        }),
        { wrapper, initialProps: { canonizeResults: false } },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ results });
      expect(result.current.data.results.length).toBe(6);
      let resultSet = new Set(result.current.data.results);
      // Since canonization is not happening, the duplicate 1 results are
      // returned as distinct objects.
      expect(resultSet.size).toBe(6);
      let values: number[] = [];
      resultSet.forEach((result: any) => values.push(result.value));
      expect(values).toEqual([0, 1, 1, 2, 3, 5]);
      rerender({ canonizeResults: true });
      act(() => {
        results.push({
          __typename: "Result",
          value: 8,
        });
        // Append another element to the results array, invalidating the
        // array itself, triggering another render (below).
        cache.writeQuery({
          query,
          overwrite: true,
          data: { results },
        });
      });

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ results });
      expect(result.current.data.results.length).toBe(7);
      resultSet = new Set(result.current.data.results);
      // Since canonization is happening now, the duplicate 1 results are
      // returned as identical (===) objects.
      expect(resultSet.size).toBe(6);
      values = [];
      resultSet.forEach((result: any) => values.push(result.value));
      expect(values).toEqual([0, 1, 2, 3, 5, 8]);
    });
  });

  describe("multiple useQuery calls per component", () => {
    type ABFields = {
      id: number;
      name: string;
    };

    const aQuery: TypedDocumentNode<{
      a: ABFields;
    }> = gql`query A { a { id name }}`;

    const bQuery: TypedDocumentNode<{
      b: ABFields;
    }> = gql`query B { b { id name }}`;

    const aData = {
      a: {
        __typename: "A",
        id: 65,
        name: "ay",
      },
    };

    const bData = {
      b: {
        __typename: "B",
        id: 66,
        name: "bee",
      },
    };

    function makeClient() {
      return new ApolloClient({
        cache: new InMemoryCache,
        link: new ApolloLink(operation => new Observable(observer => {
          setTimeout(() => {
            switch (operation.operationName) {
              case "A":
                observer.next({ data: aData });
                observer.complete();
                break;
              case "B":
                setTimeout(() => {
                  observer.next({ data: bData });
                  observer.complete();
                }, 10);
                break;
            }
          });
        })),
      });
    }

    async function check(
      aFetchPolicy: WatchQueryFetchPolicy,
      bFetchPolicy: WatchQueryFetchPolicy,
    ) {
      const client = makeClient();
      const { result, waitForNextUpdate } = renderHook(
        () => ({
          a: useQuery(aQuery, { fetchPolicy: aFetchPolicy }),
          b: useQuery(bQuery, { fetchPolicy: bFetchPolicy }),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        },
      );

      expect(result.current.a.loading).toBe(true);
      expect(result.current.b.loading).toBe(true);
      expect(result.current.a.data).toBe(undefined);
      expect(result.current.b.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.a.loading).toBe(false);
      expect(result.current.b.loading).toBe(true);
      expect(result.current.a.data).toEqual(aData);
      expect(result.current.b.data).toBe(undefined);

      await waitForNextUpdate();

      expect(result.current.a.loading).toBe(false);
      expect(result.current.b.loading).toBe(false);
      expect(result.current.a.data).toEqual(aData);
      expect(result.current.b.data).toEqual(bData);
      await expect(waitForNextUpdate({ timeout: 20 })).rejects.toThrow('Timed out');
    }

    it("cache-first for both", () => check(
      "cache-first",
      "cache-first",
    ));

    it("cache-first first, cache-and-network second", () => check(
      "cache-first",
      "cache-and-network",
    ));

    it("cache-first first, network-only second", () => check(
      "cache-first",
      "network-only",
    ));

    it("cache-and-network for both", () => check(
      "cache-and-network",
      "cache-and-network",
    ));

    it("cache-and-network first, cache-first second", () => check(
      "cache-and-network",
      "cache-first",
    ));

    it("cache-and-network first, network-only second", () => check(
      "cache-and-network",
      "network-only",
    ));

    it("network-only for both", () => check(
      "network-only",
      "network-only",
    ));

    it("network-only first, cache-first second", () => check(
      "network-only",
      "cache-first",
    ));

    it("network-only first, cache-and-network second", () => check(
      "network-only",
      "cache-and-network",
    ));
  });
});
