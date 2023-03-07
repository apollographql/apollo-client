import React, { Fragment, useEffect, useState } from 'react';
import { DocumentNode, GraphQLError } from 'graphql';
import gql from 'graphql-tag';
import { act } from 'react-dom/test-utils';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, renderHook } from '@testing-library/react';
import {
  ApolloClient,
  ApolloError,
  NetworkStatus,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from '../../../core';
import { InMemoryCache } from '../../../cache';
import { ApolloProvider, resetApolloContext } from '../../context';
import { Observable, Reference, concatPagination } from '../../../utilities';
import { ApolloLink } from '../../../link/core';
import {
  MockLink,
  MockedProvider,
  MockSubscriptionLink,
  mockSingleLink,
  tick,
} from '../../../testing';
import { QueryResult } from "../../types/types";
import { useQuery } from '../useQuery';
import { useMutation } from '../useMutation';

describe('useQuery Hook', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });
  afterEach(() => {
    resetApolloContext();
  });
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

      const { result } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: "world" });
    });

    it("useQuery result is referentially stable", async () => {
      const query = gql`{ hello }`;
      const mocks = [ {
          request: { query },
          result: { data: { hello: "world" } },
      } ];
      const wrapper = ({ children }: any) => <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      const { result, rerender } = renderHook(() => useQuery(query), { wrapper });
      let oldResult: QueryResult<any, OperationVariables>;

      await waitFor(() => {
        result.current.loading === false
      });

      rerender({ children: null });

      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
        oldResult = result.current;
      });

      await waitFor(() => {
        expect(oldResult === result.current).toBe(true);
      });
    });

    it("useQuery produces the expected renders initially", async () => {
      const query = gql`{ hello }`;
      const mocks = [ {
        request: { query },
        result: { data: { hello: "world" } },
      } ];
      const wrapper = ({ children }: any) => <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      const { result, rerender } = renderHook(() => useQuery(query), { wrapper });

      await waitFor(() => result.current.loading === false);

      rerender({ children: null });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual({ hello: "world"});
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world" });

      // Repeat frame because rerender forces useQuery to be called again
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual({ hello: "world" });
    });

    it("useQuery produces the expected frames when variables change", async () => {
      const query = gql`
        query ($id: Int) {
        hello(id: $id)
      }
      `;
      const mocks = [ {
        request: { query, variables: { id: 1 } },
        result: { data: { hello: "world 1" } },
      }, {
        request: { query, variables: { id: 2 } },
        result: { data: { hello: "world 2" } },
      } ];
      const wrapper = ({ children }: any) => <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      const { result, rerender } = renderHook(
        (options) => useQuery(query, options),
        { wrapper, initialProps: { variables: { id: 1 } } },
      );
      await waitFor(() => result.current.loading === false);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 1" });
      });
      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 1" });
      });
      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      });

      rerender({ variables: { id: 2 } });
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });
      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 2" });
      });
      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 2" });
      });
      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      });
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

      const { result, rerender } = renderHook(
        () => useQuery(query),
        { wrapper }
      );
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      const { result } = renderHook(
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
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      const { result, unmount } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.called).toBe(true);
      unmount();
    });

    it('should set called to false when skip option is true', async () => {
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

      const { result, unmount } = renderHook(
          () => useQuery(query, { skip: true }),
          { wrapper },
      );

      expect(result.current.called).toBe(false);
      unmount();
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

      const { result, rerender } = renderHook(
        ({ id }) => useQuery(query, { variables: { id }}),
        { wrapper, initialProps: { id: 1 } },
      );
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: "world 1" });

      rerender({ id: 2 });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      const { result, rerender } = renderHook(
        ({ id }) => useQuery(query, { variables: { id } }),
        { wrapper, initialProps: { id: 1 } },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: "world 1" });


      rerender({ id: 2 });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      const { result, rerender } = renderHook(
        ({ name }) => useQuery(query, { variables: { name } }),
        { wrapper, initialProps: { name: "" } },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ names: ["Alice", "Bob", "Eve"] });

      rerender({ name: 'z' });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ names: [] });

      rerender({ name: 'zz' });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ names: [] });
    });

    // An unsuccessful attempt to reproduce https://github.com/apollographql/apollo-client/issues/9135.
    it('should not return stale variables when stored in state', async () => {
      const query = gql`
        query myQuery($name: String) {
          hello(name: $name)
        }
      `;

      const mutation = gql`
        mutation myMutation($name: String) {
          updateName(name: $name)
        }
      `;

      const mocks = [
        {
          request: { query, variables: { name: "world 1" } },
          result: { data: { hello: "world 1" } },
        },
        {
          request: { query: mutation, variables: { name: "world 2" } },
          result: { data: { updateName: true } },
        },
        {
          request: { query, variables: { name: "world 2" } },
          result: { data: { hello: "world 2" } },
        },
      ];

      const cache = new InMemoryCache();
      let setName: any;
      const { result } = renderHook(
        () => {
          const [name, setName1] = React.useState("world 1");
          setName = setName1;
          return [
            useQuery(query, { variables: { name }}),
            useMutation(mutation, {
              update(cache, { data }) {
                cache.writeQuery({
                  query,
                  data: { hello: data.updateGreeting },
                });
              },
            }),
          ] as const;
        },
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
        },
      );

      expect(result.current[0].loading).toBe(true);
      expect(result.current[0].data).toBe(undefined);
      expect(result.current[0].variables).toEqual({ name: "world 1" });
      await waitFor(() => {
        expect(result.current[0].loading).toBe(false);
      }, { interval: 1 });

      expect(result.current[0].data).toEqual({ hello: "world 1" });
      expect(result.current[0].variables).toEqual({ name: "world 1" });

      const mutate = result.current[1][0];
      act(() => {
        mutate({ variables: { name: "world 2" } });
        setName("world 2");
      });

      expect(result.current[0].loading).toBe(true);
      expect(result.current[0].data).toBe(undefined);
      expect(result.current[0].variables).toEqual({ name: "world 2" });

      await waitFor(() => {
        expect(result.current[0].loading).toBe(false);
      });
      await waitFor(() => {
        expect(result.current[0].data).toEqual({ hello: "world 2" });
      });
      await waitFor(() => {
        expect(result.current[0].variables).toEqual({ name: "world 2" });
      });
    });

    // TODO: Rewrite this test
    it('should not error when forcing an update with React >= 16.13.0', async () => {
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
        <MockedProvider link={new MockLink(CAR_MOCKS)}>
          <Fragment>
            <WrapperComponent something={1} />
            <WrapperComponent something={3} />
            <WrapperComponent something={5} />
          </Fragment>
        </MockedProvider>
      );

      await waitFor(() => {
        expect(renderCount).toBe(6);
      })
      console.error = consoleError;
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
      await new Promise(resolve => setTimeout(resolve));
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

      const { result } = renderHook(
        () => useQuery(query, { ssr: false }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: "world" });
    });

    it('should keep `no-cache` results when the tree is re-rendered', async () => {
      const query1 = gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `;

      const query2 = gql`
        query Things {
          allThings {
            thing {
              description
            }
          }
        }
      `;

      const allPeopleData = {
        allPeople: { people: [{ name: 'Luke Skywalker' }] },
      };

      const allThingsData = {
        allThings: {
          thing: [{ description: 'Thing 1' }, { description: 'Thing 2' }],
        },
      };

      const link = mockSingleLink(
        {
          request: { query: query1 },
          result: { data: allPeopleData },
        },
        {
          request: { query: query2 },
          result: { data: allThingsData },
          delay: 50,
        },
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result, rerender } = renderHook(
        () => [
          useQuery(query1, { fetchPolicy: "no-cache" }),
          useQuery(query2),
        ],
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current[0].loading).toBe(true);
      expect(result.current[0].data).toBe(undefined);
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitFor(() => {
        expect(result.current[0].loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[0].data).toEqual(allPeopleData);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[1].loading).toBe(true);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[1].data).toBe(undefined);
      }, { interval: 1 });

      await waitFor(() => {
        expect(result.current[0].loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[0].data).toEqual(allPeopleData);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current[1].data).toEqual(allThingsData);
      }, { interval: 1 });

      rerender();
      expect(result.current[0].loading).toBe(false);
      expect(result.current[0].data).toEqual(allPeopleData);
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toEqual(allThingsData);
    });

    it('changing queries', async () => {
      const query1 = gql`query { hello }`;
      const query2 = gql`query { hello, name }`;
      const mocks = [
        {
          request: { query: query1 },
          result: { data: { hello: "world" } },
        },
        {
          request: { query: query2 },
          result: { data: { hello: "world", name: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const { result, rerender } = renderHook(
        ({ query }) => useQuery(query, { pollInterval: 10 }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
          initialProps: { query: query1 },
        },
      );

      expect(result.current.loading).toBe(true);
      rerender({ query: query2 });
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual(mocks[1].result.data);
    });

    it('`cache-and-network` fetch policy', async () => {
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

      const { result } = renderHook(
        () => useQuery(query, { fetchPolicy: 'cache-and-network' }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      // TODO: FIXME
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual({ hello: 'from cache' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'from link' });
    });

    it('should not use the cache when using `network-only`', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: 'from link' } },
        },
      ];

      const cache = new InMemoryCache();
      cache.writeQuery({
        query,
        data: { hello: 'from cache' },
      });

      const { result } = renderHook(
        () => useQuery(query, { fetchPolicy: 'network-only' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'from link' });
    });

    it('should use the cache when in ssrMode and fetchPolicy is `network-only`', async () => {
      const query = gql`query { hello }`;
      const link = mockSingleLink(
        {
          request: { query },
          result: { data: { hello: 'from link' } },
        },
      );

      const cache = new InMemoryCache();
      cache.writeQuery({
        query,
        data: { hello: 'from cache' },
      });

      const client = new ApolloClient({ link, cache, ssrMode: true, });
      const { result } = renderHook(
        () => useQuery(query, { fetchPolicy: 'network-only' }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'from cache' });

      await expect(waitFor(() => {
        expect(result.current.data).toEqual({ hello: 'from link' });
      }, { interval: 1, timeout: 20 })).rejects.toThrow();
    });

    it('should not hang when ssrMode is true but the cache is not populated for some reason', async () => {
      const query = gql`query { hello }`;
      const link = mockSingleLink(
        {
          request: { query },
          result: { data: { hello: 'from link' } },
        },
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
        ssrMode: true,
      });

      const { result } = renderHook(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'from link' });
    });
  });

  describe("options.defaultOptions", () => {
    it("can provide a default fetchPolicy", async () => {
      const query = gql`query { hello }`;
      const link = mockSingleLink(
        {
          request: { query },
          result: { data: { hello: 'from link' } },
        },
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const fetchPolicyLog: (string | undefined)[] = [];

      let defaultFetchPolicy: WatchQueryFetchPolicy = "cache-and-network";

      const { result } = renderHook(
        () => {
          const result = useQuery(query, {
            defaultOptions: {
              fetchPolicy: defaultFetchPolicy,
            },
          });
          fetchPolicyLog.push(result.observable.options.fetchPolicy);
          return result;
        },
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        }
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(fetchPolicyLog).toEqual([
        "cache-and-network",
      ]);

      // Change the default fetchPolicy to verify that it is not used the second
      // time useQuery is called.
      defaultFetchPolicy = "network-only";

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toEqual({ hello: 'from link' });
      expect(fetchPolicyLog).toEqual([
        "cache-and-network",
        "cache-and-network",
      ]);
    });

    it("can provide individual default variables", async () => {
      const query: TypedDocumentNode<{
        vars: OperationVariables,
      }, OperationVariables> = gql`
        query VarsQuery {
          vars
        }
      `;

      const client = new ApolloClient({
        link: new ApolloLink(request => new Observable(observer => {
          observer.next({
            data: {
              vars: request.variables,
            },
          });
          observer.complete();
        })),

        cache: new InMemoryCache(),

        defaultOptions: {
          watchQuery: {
            variables: {
              sourceOfVar: "global",
              isGlobal: true,
            },
          },
        },
      });

      const fetchPolicyLog: (string | undefined)[] = [];

      const { result } = renderHook(
        () => {
          const result = useQuery(query, {
            defaultOptions: {
              fetchPolicy: "cache-and-network",
              variables: {
                sourceOfVar: "local",
                isGlobal: false,
              } as OperationVariables,
            },
            variables: {
              mandatory: true,
            },
          });
          fetchPolicyLog.push(result.observable.options.fetchPolicy);
          return result;
        },
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        }
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.observable.variables).toEqual({
        sourceOfVar: "local",
        isGlobal: false,
        mandatory: true,
      });

      expect(
        result.current.observable.options.fetchPolicy
      ).toBe("cache-and-network");

      expect(
        // The defaultOptions field is for useQuery options (QueryHookOptions),
        // not the more general WatchQueryOptions that ObservableQuery sees.
        "defaultOptions" in result.current.observable.options
      ).toBe(false);

      expect(fetchPolicyLog).toEqual([
        "cache-and-network",
      ]);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toEqual({
        vars: {
          sourceOfVar: "local",
          isGlobal: false,
          mandatory: true,
        },
      });

      expect(fetchPolicyLog).toEqual([
        "cache-and-network",
        "cache-and-network",
      ]);

      const reobservePromise = act(() => result.current.observable.reobserve({
        fetchPolicy: "network-only",
        nextFetchPolicy: "cache-first",
        variables: {
          // Since reobserve replaces the variables object rather than merging
          // the individual variables together, we need to include the current
          // variables manually if we want them to show up in the output below.
          ...result.current.observable.variables,
          sourceOfVar: "reobserve",
        },
      }).then(finalResult => {
        expect(finalResult.loading).toBe(false);
        expect(finalResult.data).toEqual({
          vars: {
            sourceOfVar: "reobserve",
            isGlobal: false,
            mandatory: true,
          },
        });
      }));

      expect(
        result.current.observable.options.fetchPolicy
      ).toBe("cache-first");

      expect(result.current.observable.variables).toEqual({
        sourceOfVar: "reobserve",
        isGlobal: false,
        mandatory: true,
      });

      await reobservePromise;

      expect(
        result.current.observable.options.fetchPolicy
      ).toBe("cache-first");

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({
        vars: {
          sourceOfVar: "reobserve",
          isGlobal: false,
          mandatory: true,
        },
      });
      expect(
        result.current.observable.variables
      ).toEqual(
        result.current.data!.vars
      );

      expect(fetchPolicyLog).toEqual([
        "cache-and-network",
        "cache-and-network",
        "cache-first",
      ]);

      const reobserveNoVarMergePromise = act(() => result.current.observable.reobserve({
        fetchPolicy: "network-only",
        nextFetchPolicy: "cache-first",
        variables: {
          // This reobservation is like the one above, with no variable merging.
          // ...result.current.observable.variables,
          sourceOfVar: "reobserve without variable merge",
        },
      }).then(finalResult => {
        expect(finalResult.loading).toBe(false);
        expect(finalResult.data).toEqual({
          vars: {
            sourceOfVar: "reobserve without variable merge",
            // Since we didn't merge in result.current.observable.variables, we
            // don't see these variables anymore:
            // isGlobal: false,
            // mandatory: true,
          },
        });
      }));

      expect(
        result.current.observable.options.fetchPolicy
      ).toBe("cache-first");

      expect(result.current.observable.variables).toEqual({
        sourceOfVar: "reobserve without variable merge",
      });

      await reobserveNoVarMergePromise;

      expect(
        result.current.observable.options.fetchPolicy
      ).toBe("cache-first");

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({
        vars: {
          sourceOfVar: "reobserve without variable merge",
        },
      });
      expect(
        result.current.observable.variables
      ).toEqual(
        result.current.data!.vars
      );

      expect(fetchPolicyLog).toEqual([
        "cache-and-network",
        "cache-and-network",
        "cache-first",
        "cache-first",
      ]);
    });

    it("defaultOptions do not confuse useQuery when unskipping a query (issue #9635)", async () => {
      const query: TypedDocumentNode<{
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
          const [skip, setSkip] = useState(true);
          return {
            setSkip,
            query: useQuery(query, {
              skip,
              defaultOptions: {
                fetchPolicy: defaultFetchPolicy,
              },
            }),
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
      expect(result.current.query.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.query.data).toBeUndefined();

      await expect(waitFor(() => {
        expect(result.current.query.data).toEqual({ counter: 1 });
      }, { interval: 1, timeout: 20 })).rejects.toThrow();

      act(() => {
        result.current.setSkip(false);
      });
      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.query.data).toBeUndefined();
      await waitFor(() => {
        expect(result.current.query.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.query.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.query.data).toEqual({ counter: 1 });

      const { options } = result.current.query.observable;
      expect(options.fetchPolicy).toBe(defaultFetchPolicy);

      act(() => {
        result.current.setSkip(true);
      });
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.query.data).toBeUndefined();

      await expect(waitFor(() => {
        expect(result.current.query.data).toEqual({ counter: 1 });
      }, { interval: 1, timeout: 20 })).rejects.toThrow();

      act(() => {
        result.current.setSkip(false);
      });
      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.query.data).toEqual({ counter: 1 });
      await waitFor(() => {
        expect(result.current.query.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.query.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.query.data).toEqual({ counter: 2 });

      expect(options.fetchPolicy).toBe(defaultFetchPolicy);
    });
  });

  it("can provide options.client without ApolloProvider", async () => {
    const query = gql`query { hello }`;
    const link = mockSingleLink(
      {
        request: { query },
        result: { data: { hello: 'from link' } },
      },
    );

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
      ssrMode: true,
    });

    const { result } = renderHook(
      () => useQuery(query, { client }),
      // We deliberately do not provide the usual ApolloProvider wrapper for
      // this test, since we are providing the client directly to useQuery.
      // {
      //   wrapper: ({ children }) => (
      //     <ApolloProvider client={client}>
      //       {children}
      //     </ApolloProvider>
      //   ),
      // }
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { interval: 1 });

    expect(result.current.data).toEqual({ hello: 'from link' });
  });

  describe('<React.StrictMode>', () => {
    it("double-rendering should not trigger duplicate network requests", async () => {
      const query: TypedDocumentNode<{
        linkCount: number;
      }> = gql`query Counter { linkCount }`;

      let linkCount = 0;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(request => new Observable(observer => {
          if (request.operationName === "Counter") {
            observer.next({
              data: {
                linkCount: ++linkCount,
              },
            });
            observer.complete();
          }
        })),
      });

      const { result } = renderHook(
        () => useQuery(query, {
          fetchPolicy: "cache-and-network",
        }),
        {
          wrapper: ({ children }) => (
            <React.StrictMode>
              <ApolloProvider client={client}>{children}</ApolloProvider>
            </React.StrictMode>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({
        linkCount: 1,
      });

      function checkObservableQueries(expectedLinkCount: number) {
        const obsQueries = client.getObservableQueries("all");
        expect(obsQueries.size).toBe(2);

        const activeSet = new Set<typeof result.current.observable>();
        const inactiveSet = new Set<typeof result.current.observable>();
        obsQueries.forEach(obsQuery => {
          if (obsQuery.hasObservers()) {
            expect(inactiveSet.has(obsQuery)).toBe(false);
            activeSet.add(obsQuery);
            expect(obsQuery.getCurrentResult()).toEqual({
              loading: false,
              networkStatus: NetworkStatus.ready,
              data: {
                linkCount: expectedLinkCount,
              },
            });
          } else {
            expect(activeSet.has(obsQuery)).toBe(false);
            inactiveSet.add(obsQuery);
          }
        });
        expect(activeSet.size).toBe(1);
        expect(inactiveSet.size).toBe(1);
      }

      checkObservableQueries(1);

      await result.current.reobserve().then(result => {
        expect(result.loading).toBe(false);
        expect(result.loading).toBe(false);
        expect(result.networkStatus).toBe(NetworkStatus.ready);
        expect(result.data).toEqual({
          linkCount: 2,
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          linkCount: 2,
        });
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      }, { interval: 1 });

      checkObservableQueries(2);
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

      const { result } = renderHook(
        () => useQuery(query, { pollInterval: 10 }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 1" });
      }, { interval: 1 });

      expect(result.current.loading).toBe(false);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 2" });
      }, { interval: 1 });

      expect(result.current.loading).toBe(false);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 3" });
      }, { interval: 1 });

      expect(result.current.loading).toBe(false);

      const { data: previousData } = result.current;
      result.current.stopPolling();
      await expect(waitFor(() => {
        expect(result.current.data).not.toEqual(previousData);
      }, { interval: 1, timeout: 20 })).rejects.toThrow();
    });

    it('should start polling when skip goes from true to false', async () => {
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
          delay: 10,
        },
        {
          request: { query },
          result: { data: { hello: "world 3" } },
          delay: 10,
        },
      ];

      const cache = new InMemoryCache();
      const { result, rerender } = renderHook(
        ({ skip }) => useQuery(query, { pollInterval: 10, skip }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
          initialProps: { skip: undefined } as any
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });

      rerender({ skip: true });
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);

      await expect(waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 1" });
      }, { interval: 1, timeout: 20 })).rejects.toThrow()

      rerender({ skip: false });
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world 1" });

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 2" });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 3" });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);
    });

    it("should return data from network when clients default fetch policy set to network-only", async () => {
      const query = gql`{ hello }`;
      const data = { hello: "world" };
      const mocks = [
        {
          request: { query },
          result: { data },
        },
      ];

      const cache = new InMemoryCache();
      cache.writeQuery({
        query,
        data: { hello: "world 2" },
      });

      const wrapper = ({ children }: any) => (
        <MockedProvider
          mocks={mocks}
          cache={cache}
          defaultOptions={{ watchQuery: { fetchPolicy: "network-only" } }}
        >
          {children}
        </MockedProvider>
      );

      const { result } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual(data);
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

      const { result, unmount } = renderHook(
        () => useQuery(query, { pollInterval: 10 }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 1" });
      });
      await waitFor(() => {
        expect(requestSpy).toHaveBeenCalledTimes(1);
      })

      unmount();

      await expect(waitFor(() => {
        expect(requestSpy).not.toHaveBeenCalledTimes(1);
      }, { interval: 1, timeout: 20 })).rejects.toThrow();
      await waitFor(() => {
        expect(onErrorFn).toHaveBeenCalledTimes(0);
      });
      requestSpy.mockRestore();
    });

    it('should stop polling when component is unmounted in Strict Mode', async () => {
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
          delay: 10,
        },
        {
          request: { query },
          result: { data: { hello: "world 3" } },
          delay: 10,
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

      const { result, unmount } = renderHook(
        () => useQuery(query, { pollInterval: 10 }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: "world 1" });
      expect(requestSpy).toHaveBeenCalledTimes(1);

      unmount();

      await expect(waitFor(() => {
        expect(requestSpy).not.toHaveBeenCalledTimes(1);
      }, { interval: 1, timeout: 20 })).rejects.toThrow();
      expect(onErrorFn).toHaveBeenCalledTimes(0);
      requestSpy.mockRestore();
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
        {
          request: { query },
          result: { data: { hello: "world 3" } },
        },
        {
          request: { query },
          result: { data: { hello: "world 4" } },
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

      const { result } = renderHook(
        () => useQuery(query, { pollInterval: 20 }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 1" });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);
      

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 2" });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);
      
      
      result.current.stopPolling();

      await expect(waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 3" });
      }, { interval: 1, timeout: 20 })).rejects.toThrow();
      result.current.startPolling(20);

      expect(requestSpy).toHaveBeenCalledTimes(2);
      expect(onErrorFn).toHaveBeenCalledTimes(0);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 3" });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: "world 4" });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);
      expect(requestSpy).toHaveBeenCalledTimes(4);
      expect(onErrorFn).toHaveBeenCalledTimes(0);
      requestSpy.mockRestore();
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

      const { result, unmount } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

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

      const { result } = renderHook(
        () => useQuery(query),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');
    });

    it('calls `onError` when a GraphQL error is returned', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('error')],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, { onError }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          new ApolloError({ graphQLErrors: [new GraphQLError('error')] })
        );
      });
    });

    it('calls `onError` when a network error has occured', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          error: new Error('Could not fetch')
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, { onError }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('Could not fetch');
      expect(result.current.error!.networkError).toEqual(
        new Error('Could not fetch')
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          new ApolloError({ networkError: new Error('Could not fetch') })
        );
      });
    });

    it('removes partial data from result when response has errors', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')]
          }
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, { onError }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('Could not fetch "hello"');
      expect(result.current.error!.graphQLErrors).toEqual([
        new GraphQLError('Could not fetch "hello"')
      ]);
    });

    it('does not call `onError` when returning GraphQL errors while using an `errorPolicy` set to "ignore"', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('error')]
          }
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, { onError, errorPolicy: 'ignore' }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeUndefined();

      await tick();

      expect(onError).not.toHaveBeenCalled();
    });

    it('calls `onError` when a network error has occurred while using an `errorPolicy` set to "ignore"', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          error: new Error('Could not fetch')
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, { onError, errorPolicy: 'ignore' }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('Could not fetch');
      expect(result.current.error!.networkError).toEqual(
        new Error('Could not fetch')
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          new ApolloError({ networkError: new Error('Could not fetch') })
        );
      });
    });

    it('returns partial data and discards GraphQL errors when using an `errorPolicy` set to "ignore"', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')]
          }
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const { result } = renderHook(
        () => useQuery(query, { errorPolicy: 'ignore' }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toEqual({ hello: null })
      expect(result.current.error).toBeUndefined();
    });

    it('calls `onCompleted` with partial data but avoids calling `onError` when using an `errorPolicy` set to "ignore"', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')]
          }
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const onCompleted = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, { onError, onCompleted, errorPolicy: 'ignore' }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toEqual({ hello: null })
      expect(result.current.error).toBeUndefined();

      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalledWith({ hello: null });
      });
      await waitFor(() => {
        expect(onError).not.toHaveBeenCalled();
      });
    });

    it('calls `onError` when returning GraphQL errors while using an `errorPolicy` set to "all"', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError('error')]
          }
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, { onError, errorPolicy: 'all' }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');
      expect(result.current.error!.graphQLErrors).toEqual([
        new GraphQLError('error')
      ]);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          new ApolloError({ graphQLErrors: [new GraphQLError('error')] })
        );
      });
    });

    it('returns partial data when returning GraphQL errors while using an `errorPolicy` set to "all"', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')]
          }
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, { onError, errorPolicy: 'all' }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toEqual({ hello: null });
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('Could not fetch "hello"');
      expect(result.current.error!.graphQLErrors).toEqual([
        new GraphQLError('Could not fetch "hello"')
      ]);
    });

    it('calls `onError` but not `onCompleted` when returning partial data with GraphQL errors while using an `errorPolicy` set to "all"', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')]
          }
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>
      );

      const onError = jest.fn();
      const onCompleted = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, { onError, onCompleted, errorPolicy: 'all' }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toEqual({ hello: null });
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('Could not fetch "hello"');
      expect(result.current.error!.graphQLErrors).toEqual([
        new GraphQLError('Could not fetch "hello"')
      ]);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          new ApolloError({
            graphQLErrors: [new GraphQLError('Could not fetch "hello"')]
          })
        );
      });
      await waitFor(() => {
        expect(onCompleted).not.toHaveBeenCalled();
      });
    });

    it('calls `onError` a single time when refetching returns a successful result', async () => {
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
      const { result } = renderHook(
        () => useQuery(query, {
          onError,
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      await new Promise((resolve) => setTimeout(resolve));
      expect(onError).toHaveBeenCalledTimes(1);

      result.current.refetch();
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      let updates = 0;
      const { result, rerender } = renderHook(
        () => (updates++, useQuery(query)),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      rerender();

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      let previousUpdates = updates;
      await expect(waitFor(() => {
        expect(updates).not.toEqual(previousUpdates)
      }, { interval: 1, timeout: 20 })).rejects.toThrow()
    });

    it('should not return partial data from cache on refetch with errorPolicy: none (default) and notifyOnNetworkStatusChange: true', async () => {
      const query = gql`
        {
          dogs {
            id
            breed
          }
        }
      `;

      const GET_DOG_DETAILS = gql`
        query dog($breed: String!) {
          dog(breed: $breed) {
            id
            unexisting
          }
          dogs {
            id
            breed
          }
        }
      `;

      const dogData = [
        {
          "id": "Z1fdFgU",
          "breed": "affenpinscher",
          "__typename": "Dog"
        },
        {
          "id": "ZNDtCU",
          "breed": "airedale",
          "__typename": "Dog"
        },
      ];

      const detailsMock = (breed: string) => ({
        request: { query: GET_DOG_DETAILS, variables: { breed } },
        result: {
          errors: [new GraphQLError(`Cannot query field "unexisting" on type "Dog".`)],
        },
      });

      const mocks = [
        {
          request: { query },
          result: { data: { dogs: dogData } },
        },
        // use the same mock for the initial query on select change
        // and subsequent refetch() call
        detailsMock('airedale'),
        detailsMock('airedale'),
      ];
      const Dogs: React.FC<{
        onDogSelected: (event: React.ChangeEvent<HTMLSelectElement>) => void;
      }> = ({ onDogSelected }) => {
        const { loading, error, data } = useQuery<
          { dogs: { id: string; breed: string; }[] }
        >(query);

        if (loading) return <>Loading...</>;
        if (error) return <>{`Error! ${error.message}`}</>;

        return (
          <select name="dog" onChange={onDogSelected}>
            {data?.dogs.map((dog) => (
              <option key={dog.id} value={dog.breed}>
                {dog.breed}
              </option>
            ))}
          </select>
        );
      };

      const DogDetails: React.FC<{
        breed: string;
      }> = ({ breed }) => {
        const { loading, error, data, refetch, networkStatus } = useQuery(
          GET_DOG_DETAILS,
          {
            variables: { breed },
            notifyOnNetworkStatusChange: true
          }
        );
        if (networkStatus === 4) return <p>Refetching!</p>;
        if (loading) return <p>Loading!</p>;
        return (
          <div>
            <div>
              {data ? 'Partial data rendered' : null}
            </div>

            <div>
              {error ? (
                `Error!: ${error}`
                ) : (
                'Rendering!'
              )}
            </div>
            <button onClick={() => refetch()}>Refetch!</button>
          </div>
        );
      };

      const ParentComponent: React.FC = () => {
        const [selectedDog, setSelectedDog] = useState<null | string>(null);
        function onDogSelected(event: React.ChangeEvent<HTMLSelectElement>) {
          setSelectedDog(event.target.value);
        }
        return (
          <MockedProvider mocks={mocks}>
            <div>
              {selectedDog && <DogDetails breed={selectedDog} />}
              <Dogs onDogSelected={onDogSelected} />
            </div>
          </MockedProvider>
        );
      };

      render(<ParentComponent />);

      // on initial load, the list of dogs populates the dropdown
      await screen.findByText('affenpinscher');

      // the user selects a different dog from the dropdown which
      // fires the GET_DOG_DETAILS query, retuning an error
      const user = userEvent.setup();
      await user.selectOptions(
        screen.getByRole('combobox'),
        screen.getByRole('option', { name: 'airedale' })
      );

      // With the default errorPolicy of 'none', the error is rendered
      // and partial data is not
      await screen.findByText('Error!: ApolloError: Cannot query field "unexisting" on type "Dog".')
      expect(screen.queryByText(/partial data rendered/i)).toBeNull();

      // When we call refetch...
      await user.click(screen.getByRole('button', { name: /Refetch!/i }))

      // The error is still present, and partial data still not rendered
      await screen.findByText('Error!: ApolloError: Cannot query field "unexisting" on type "Dog".')
      expect(screen.queryByText(/partial data rendered/i)).toBeNull();
    });

    it('should return partial data from cache on refetch', async () => {
      const GET_DOG_DETAILS = gql`
        query dog($breed: String!) {
          dog(breed: $breed) {
            id
          }
        }
      `;
      const detailsMock = (breed: string) => ({
        request: { query: GET_DOG_DETAILS, variables: { breed } },
        result: {
          data: {
            dog: {
              "id": "ZNDtCU",
              "__typename": "Dog"
            }
          }
        },
      });

      const mocks = [
        // use the same mock for the initial query on select change
        // and subsequent refetch() call
        detailsMock('airedale'),
        detailsMock('airedale'),
      ];

      const DogDetails: React.FC<{
        breed?: string;
      }> = ({ breed = "airedale" }) => {
        const { data, refetch, networkStatus } = useQuery(
          GET_DOG_DETAILS,
          {
            variables: { breed },
            notifyOnNetworkStatusChange: true
          }
        );
        if (networkStatus === 1) return <p>Loading!</p>;
        return (
          // Render existing results, but dim the UI until the results
          // have finished loading...
          <div style={{ opacity: networkStatus === 4 ? 0.5 : 1 }}>
            <div>
              {data ? 'Data rendered' : null}
            </div>
            <button onClick={() => refetch()}>Refetch!</button>
          </div>
        );
      };

      const ParentComponent: React.FC = () => {
        return (
          <MockedProvider mocks={mocks}>
            <DogDetails />
          </MockedProvider>
        );
      };

      render(<ParentComponent />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Loading!')).toBeTruthy();
      }, { interval: 1 });

      await waitFor(() => {
        expect(screen.getByText('Data rendered')).toBeTruthy();
      }, { interval: 1 });

      // When we call refetch...
      await user.click(screen.getByRole('button', { name: /Refetch!/i }))

      // Data from the cache remains onscreen while network request
      // is made
      expect(screen.getByText('Data rendered')).toBeTruthy();
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

      let updates = 0;
      const { result, rerender } = renderHook(
        () => (updates++, useQuery(query, { onError: () => {}, onCompleted: () => {} })),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

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
      let previousUpdates = updates;
      await expect(waitFor(() => {
        expect(updates).not.toEqual(previousUpdates)
      }, { interval: 1, timeout: 20 })).rejects.toThrow()
    });

    it('should not persist errors when variables change', async () => {
      const query = gql`
        query hello($id: ID) {
          hello(id: $id)
        }
      `;

      const mocks = [
        {
          request: {
            query,
            variables: { id: 1 },
          },
          result: {
            errors: [new GraphQLError('error')]
          },
        },
        {
          request: {
            query,
            variables: { id: 2 },
          },
          result: {
            data: { hello: 'world 2' },
          },
        },
        {
          request: {
            query,
            variables: { id: 1 },
          },
          result: {
            data: { hello: 'world 1' },
          },
        },
      ];

      const { result, rerender } = renderHook(
        ({ id }) => useQuery(query, { variables: { id } }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          ),
          initialProps: { id: 1 },
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error');

      rerender({ id: 2 });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'world 2' });
      expect(result.current.error).toBe(undefined);

      rerender({ id: 1 });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'world 1' });
      expect(result.current.error).toBe(undefined);
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

      const { result } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('error 1');

      const catchFn = jest.fn();

      result.current.refetch().catch(catchFn);
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      const { result } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

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

      const { result } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('same error');

      result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(result.current.error).toBe(undefined);

      const catchFn = jest.fn();
      result.current.refetch().catch(catchFn);

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(result.current.error).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      // TODO: Is this correct behavior here?
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.error!.message).toBe('same error');

      expect(catchFn.mock.calls.length).toBe(1);
      expect(catchFn.mock.calls[0].length).toBe(1);
      expect(catchFn.mock.calls[0][0]).toBeInstanceOf(ApolloError);
      expect(catchFn.mock.calls[0][0].message).toBe('same error');
    });

    it('should call onCompleted when variables change', async () => {
      const query = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data1 = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
      const data2 = { allPeople: { people: [{ name: 'Han Solo' }] } };
      const mocks = [
        {
          request: { query, variables: { first: 1 } },
          result: { data: data1 },
        },
        {
          request: { query, variables: { first: 2 } },
          result: { data: data2 },
        },
      ];

      const onCompleted = jest.fn();

      const { result, rerender } = renderHook(
        ({ variables }) => useQuery(query, { variables, onCompleted }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          ),
          initialProps: {
            variables: { first: 1 },
          },
        },
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual(data1);
      expect(onCompleted).toHaveBeenLastCalledWith(data1);

      rerender({ variables: { first: 2 } });
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual(data2);
      expect(onCompleted).toHaveBeenLastCalledWith(data2);

      rerender({ variables: { first: 1 } });
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(data1);
      await waitFor(() => {
        expect(onCompleted).toHaveBeenLastCalledWith(data1);
      }, { interval: 1 });

      expect(onCompleted).toHaveBeenCalledTimes(3);
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

      const { result } = renderHook(
        () => useQuery(query, { variables: { limit: 2 } }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab });

      await waitFor(() => void result.current.fetchMore({
        variables: { limit: 2 },
        updateQuery: (prev, { fetchMoreResult }) => ({
          letters: prev.letters.concat(fetchMoreResult.letters),
        }),
      }));

      await waitFor(() => {
        expect(result.current.data).toEqual({ letters: ab.concat(cd) });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);

      warnSpy.mockRestore();
    });

    it('should fetchMore with updateQuery and notifyOnNetworkStatusChange', async () => {
      // TODO: Calling fetchMore with an updateQuery callback is deprecated
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      const { result } = renderHook(
        () => useQuery(query, {
          variables: { limit: 2 },
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab });

      act(() => void result.current.fetchMore({
        variables: { limit: 2 },
        updateQuery: (prev, { fetchMoreResult }) => ({
          letters: prev.letters.concat(fetchMoreResult.letters),
        }),
      }));

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.fetchMore);
      expect(result.current.data).toEqual({ letters: ab });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      const { result } = renderHook(
        () => useQuery(query, { variables: { limit: 2 } }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab });
      result.current.fetchMore({ variables: { limit: 2 } });

      expect(result.current.loading).toBe(false);
      await waitFor(() => {
        expect(result.current.data).toEqual({ letters: ab.concat(cd) });
      }, { interval: 1 });
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
    });

    it('fetchMore with concatPagination and notifyOnNetworkStatusChange', async () => {
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

      const { result } = renderHook(
        () => useQuery(query, {
          variables: { limit: 2 },
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab });

      act(() => void result.current.fetchMore({ variables: { limit: 2 } }));
      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.fetchMore);
      expect(result.current.data).toEqual({ letters: ab });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({ letters: ab.concat(cd) });
    });

    it("regression test for issue #8600", async () => {
      const cache = new InMemoryCache({
        typePolicies: {
          Country: {
            fields: {
              cities: {
                keyArgs: ['size'],
                merge(existing, incoming, { args }) {
                  if (!args) return incoming

                  const items = existing ? existing.slice(0) : []

                  const offset = args.offset ?? 0
                  for (let i = 0; i < incoming.length; ++i) {
                    items[offset + i] = incoming[i]
                  }

                  return items
                },
              },
            },
          },
          CityInfo: {
            merge: true,
          },
        },
      });

      const GET_COUNTRIES = gql`
        query GetCountries {
          countries {
            id
            ...WithSmallCities
            ...WithAirQuality
          }
        }
        fragment WithSmallCities on Country {
          biggestCity {
            id
          }
          smallCities: cities(size: SMALL) {
            id
          }
        }
        fragment WithAirQuality on Country {
          biggestCity {
            id
            info {
              airQuality
            }
          }
        }
      `;

      const countries = [
        {
          __typename: 'Country',
          id: 123,
          biggestCity: {
            __typename: 'City',
            id: 234,
            info: {
              __typename: 'CityInfo',
              airQuality: 0,
            },
          },
          smallCities: [
            { __typename: 'City', id: 345 },
          ],
        },
      ];

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={[
          {
            request: { query: GET_COUNTRIES },
            result: { data: { countries } },
          },
        ]} cache={cache}>{children}</MockedProvider>
      );

      const { result } = renderHook(
        () => useQuery(GET_COUNTRIES),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ countries });
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

      const { result } = renderHook(
        () => useQuery(query, {
          variables: { id: 1 },
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'world 1' });

      result.current.refetch({ id: 2 });
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'world 2' });
    });

    it('refetching after an error', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: 'world 1' } },
        },
        {
          request: { query },
          error: new Error('This is an error!'),
          delay: 10,
        },
        {
          request: { query },
          result: { data: { hello: 'world 2' } },
          delay: 10,
        },
      ];

      const cache = new InMemoryCache();

      const { result } = renderHook(
        () => useQuery(query, {
          notifyOnNetworkStatusChange: true,
        }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.error).toBe(undefined);
      expect(result.current.data).toEqual({ hello: 'world 1' });

      result.current.refetch();
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });
      expect(result.current.error).toBe(undefined);
      expect(result.current.data).toEqual({ hello: 'world 1' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.error).toBeInstanceOf(ApolloError);
      expect(result.current.data).toEqual({ hello: 'world 1' });

      result.current.refetch();
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });
      expect(result.current.error).toBe(undefined);
      expect(result.current.data).toEqual({ hello: 'world 1' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.error).toBe(undefined);
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

        const { result } = renderHook(
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

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        }, { interval: 1 });
        expect(result.current.error).toBeUndefined();
        expect(result.current.data).toEqual({ primes: [2, 3, 5, 7, 11] });
        expect(mergeParams).toEqual([
          [void 0, [2, 3, 5, 7, 11]],
        ]);


        const thenFn = jest.fn();
        result.current.refetch({ min: 12, max: 30 }).then(thenFn);

        await waitFor(() => {
          expect(result.current.loading).toBe(true);
        }, { interval: 1 });
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toEqual({
          // We get the stale data because we configured keyArgs: false.
          primes: [2, 3, 5, 7, 11],
        });

        // This networkStatus is setVariables instead of refetch because we
        // called refetch with new variables.
        expect(result.current.networkStatus).toBe(NetworkStatus.setVariables);

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        }, { interval: 1 });

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

        const { result } = renderHook(
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

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        }, { interval: 1 });
        expect(result.current.error).toBeUndefined();
        expect(result.current.data).toEqual({ primes: [2, 3, 5, 7, 11] });
        expect(mergeParams).toEqual([
          [undefined, [2, 3, 5, 7, 11]],
        ]);


        const thenFn = jest.fn();
        result.current.refetch({ min: 12, max: 30 }).then(thenFn);

        await waitFor(() => {
          expect(result.current.loading).toBe(true);
        }, { interval: 1 });
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toEqual({
          // We get the stale data because we configured keyArgs: false.
          primes: [2, 3, 5, 7, 11],
        });
        // This networkStatus is setVariables instead of refetch because we
        // called refetch with new variables.
        expect(result.current.networkStatus).toBe(NetworkStatus.setVariables);
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        }, { interval: 1 });

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

        const { result } = renderHook(
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

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        }, { interval: 1 });
        expect(result.current.error).toBeUndefined();
        expect(result.current.data).toEqual({ primes: [2, 3, 5, 7, 11] });
        expect(mergeParams).toEqual([
          [void 0, [2, 3, 5, 7, 11]],
        ]);


        const thenFn = jest.fn();
        result.current.refetch({ min: 12, max: 30 }).then(thenFn);

        await waitFor(() => {
          expect(result.current.loading).toBe(true);
        }, { interval: 1 });
        expect(result.current.error).toBe(undefined);
        expect(result.current.data).toEqual({
          // We get the stale data because we configured keyArgs: false.
          primes: [2, 3, 5, 7, 11],
        });

        // This networkStatus is setVariables instead of refetch because we
        // called refetch with new variables.
        expect(result.current.networkStatus).toBe(NetworkStatus.setVariables);

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        }, { interval: 1 });

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
      const { result } = renderHook(
        () => (useQuery(query, {
          fetchPolicy: 'cache-only',
          onCompleted,
        })),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: 'world' });
      }, { interval: 1 });
      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalledTimes(1);
      }, { interval: 1 });
      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalledWith({ hello: 'world' });
      }, { interval: 1 });
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
      const { result, rerender } = renderHook(
        () => useQuery(query, {
          onCompleted,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

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
      const { result } = renderHook(
        () => useQuery(query, {
          skip: true,
          onCompleted,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);

      await expect(waitFor(() => {
        expect(onCompleted).not.toHaveBeenCalledTimes(0);
      }, { interval: 1, timeout: 20 })).rejects.toThrow();
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
      let updates = 0;
      const { result } = renderHook(
        () => {
          const pendingResult = useQuery(query, {
            fetchPolicy: 'network-only',
            onCompleted,
          });
          updates++;

          return pendingResult;
        },
        { wrapper },
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'world' });
      const previousUpdates = updates
      await expect(waitFor(() => {
        expect(updates).not.toEqual(previousUpdates)
      }, { interval: 1, timeout: 20 })).rejects.toThrow();
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    it('onCompleted should work with polling', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: 'world 1' } },
        },
        {
          request: { query },
          result: { data: { hello: 'world 2' } },
        },
        {
          request: { query },
          result: { data: { hello: 'world 3' } },
        },
      ];

      const cache = new InMemoryCache();
      const onCompleted = jest.fn();
      const { result } = renderHook(
        () => useQuery(query, {
          onCompleted,
          pollInterval: 10,
        }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: 'world 1' });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);
      expect(onCompleted).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: 'world 2' });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);
      expect(onCompleted).toHaveBeenCalledTimes(2);

      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: 'world 3' });
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);
      expect(onCompleted).toHaveBeenCalledTimes(3);
    });

    // This test was added for issue https://github.com/apollographql/apollo-client/issues/9794
    it("onCompleted can set state without causing react errors", async () => {
      const errorSpy = jest.spyOn(console, "error");
      const query = gql`
        {
          hello
        }
      `;

      const cache = new InMemoryCache();
      cache.writeQuery({
        query,
        data: { hello: "world" },
      });

      const ChildComponent: React.FC<{
        setOnCompletedCalled: React.Dispatch<React.SetStateAction<boolean>>;
      }> = ({ setOnCompletedCalled }) => {
        useQuery(query, {
          fetchPolicy: "cache-only",
          onCompleted: () => {
            setOnCompletedCalled(true);
          },
        });

        return null;
      };

      const ParentComponent: React.FC = () => {
        const [onCompletedCalled, setOnCompletedCalled] = useState(false);
        return (
          <MockedProvider mocks={[]} cache={cache}>
            <div>
              <ChildComponent setOnCompletedCalled={setOnCompletedCalled} />
              onCompletedCalled: {String(onCompletedCalled)}
            </div>
          </MockedProvider>
        );
      };

      render(<ParentComponent />);
      await screen.findByText("onCompletedCalled: true");
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
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
          delay: 500,
        }
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      const { result } = renderHook(
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

      await waitFor(() => {
        expect(result.current.query.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(carsData);

      act(() => void mutate());
      // The mutation ran and is loading the result. The query stays at not
      // loading as nothing has changed for the query, but optimistic data is
      // rendered.

      expect(result.current.mutation[1].loading).toBe(true);
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(allCarsData);

      expect(onError).toHaveBeenCalledTimes(0);
      await tick();
      // The mutation ran and is loading the result. The query stays at
      // not loading as nothing has changed for the query.
      expect(result.current.mutation[1].loading).toBe(true);
      expect(result.current.query.loading).toBe(false);

      await waitFor(() => {
        expect(result.current.mutation[1].loading).toBe(false);
      })

      // The mutation has completely finished, leaving the query with access to
      // the original cache data.
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(carsData);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toBe('Oh no!');
    });
  });

  describe('Partial refetch', () => {
    it('should attempt a refetch when data is missing and partialRefetch is true', async () => {
      const errorSpy = jest.spyOn(console, 'error')
        .mockImplementation(() => {});
      const query = gql`{ hello }`;

      const link = mockSingleLink(
        {
          request: { query },
          result: { data: {} },
          delay: 20,
        },
        {
          request: { query },
          result: { data: { hello: "world" } },
          delay: 20,
        }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useQuery(query, {
          partialRefetch: true,
          notifyOnNetworkStatusChange: true,
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);

      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.refetch);
      }, { interval: 1 });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatch('Missing field');
      errorSpy.mockRestore();

      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      }, { interval: 1 });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(result.current.error).toBe(undefined);
    });

    it('should attempt a refetch when data is missing and partialRefetch is true 2', async () => {
      const query = gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `;

      const data = {
        allPeople: { people: [{ name: 'Luke Skywalker' }] },
      };

      const errorSpy = jest.spyOn(console, 'error')
        .mockImplementation(() => {});
      const link = mockSingleLink(
        { request: { query }, result: { data: {} }, delay: 20 },
        { request: { query }, result: { data }, delay: 20 }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useQuery(query, {
          partialRefetch: true,
          notifyOnNetworkStatusChange: true,
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);

      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.refetch);
      }, { interval: 1 });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatch('Missing field');
      errorSpy.mockRestore();

      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      }, { interval: 1 });
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(data);
      expect(result.current.error).toBe(undefined);
    });

    it('should attempt a refetch when data is missing, partialRefetch is true and addTypename is false for the cache', async () => {
      const errorSpy = jest.spyOn(console, 'error')
        .mockImplementation(() => {});
      const query = gql`{ hello }`;

      const link = mockSingleLink(
        {
          request: { query },
          result: { data: {} },
          delay: 20,
        },
        {
          request: { query },
          result: { data: { hello: "world" } },
          delay: 20,
        }
      );

      const client = new ApolloClient({
        link,
        // THIS LINE IS THE ONLY DIFFERENCE FOR THIS TEST
        cache: new InMemoryCache({ addTypename: false }),
      });

      const wrapper = ({ children }: any) => (
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
      );

      const { result } = renderHook(
        () => useQuery(query, {
          partialRefetch: true,
          notifyOnNetworkStatusChange: true,
        }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);

      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.refetch);
      }, { interval: 1 });
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(undefined);
      expect(result.current.data).toBe(undefined);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatch('Missing field');
      errorSpy.mockRestore();

      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      }, { interval: 1 });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: 'world' });
      expect(result.current.error).toBe(undefined);
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

      const { result } = renderHook(
        () => useQuery(query, { variables: { id: entityId } }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

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

      await waitFor(() => {
        expect(result.current.data).toEqual({
          clientEntity: {
            id: entityId,
            title: longerTitle,
            titleLength: longerTitle.length,
            __typename: "ClientData",
          },
        });
      }, { interval: 1 });
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

      const { result, rerender } = renderHook(
        ({ skip }) => useQuery(query, { skip }),
        { wrapper, initialProps: { skip: true }  },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);
      rerender({ skip: false });

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBeFalsy();
      }, { interval: 1 });
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

      const { result, rerender } = renderHook(
        ({ skip, variables }) => useQuery(query, { skip, variables }),
        { wrapper, initialProps: { skip: false, variables: undefined as any } },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      expect(client.getObservableQueries('all').size).toBe(1);
      unmount();
      await new Promise(resolve => setTimeout(resolve));
      expect(client.getObservableQueries('all').size).toBe(0);
    });

    it('should treat fetchPolicy standby like skip', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: 'world' } },
        },
      ];
      const { result, rerender } = renderHook(
        ({ fetchPolicy }) => useQuery(query, { fetchPolicy }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          ),
          initialProps: { fetchPolicy: 'standby' as any },
        },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(undefined);

      await expect(waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1, timeout: 20 })).rejects.toThrow();

      rerender({ fetchPolicy: 'cache-first' });
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBeFalsy();
      }, { interval: 1 });
      expect(result.current.data).toEqual({ hello: 'world' });
    });

    // Amusingly, #8270 thinks this is a bug, but #9101 thinks this is not.
    it('should refetch when skip is true', async () => {
      const query = gql`{ hello }`;
      const link = new ApolloLink(() => Observable.of({
        data: { hello: 'world' },
      }));

      const requestSpy = jest.spyOn(link, 'request');
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      const { result } = renderHook(
        () => useQuery(query, { skip: true }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      let promise;
      await waitFor(async () => {
        promise = result.current.refetch();
      });

      expect(result.current.loading).toBe(false);
      await waitFor(() => {
        expect(result.current.data).toBe(undefined);
      }, { interval: 1 });

      expect(result.current.loading).toBe(false);
      await waitFor(() => {
        expect(result.current.data).toBe(undefined);
      }, { interval: 1 });
      expect(requestSpy).toHaveBeenCalledTimes(1);
      requestSpy.mockRestore();
      expect(promise).resolves.toEqual({
        data: {hello: "world"},
        loading: false,
        networkStatus: 7,
      });
    });

    it('should set correct initialFetchPolicy even if skip:true', async () => {
      const query = gql`{ hello }`;
      let linkCount = 0;
      const link = new ApolloLink(() => Observable.of({
        data: { hello: ++linkCount },
      }));

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      const correctInitialFetchPolicy: WatchQueryFetchPolicy =
        "cache-and-network";

      const { result, rerender } = renderHook<QueryResult, {
        skip: boolean;
      }>(
        ({ skip = true }) => useQuery(query, {
          // Skipping equates to using a fetchPolicy of "standby", but that
          // should not mean we revert to standby whenever we want to go back to
          // the initial fetchPolicy (e.g. when variables change).
          skip,
          fetchPolicy: correctInitialFetchPolicy,
        }),
        {
          initialProps: {
            skip: true,
          },
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeUndefined();

      function check(
        expectedFetchPolicy: WatchQueryFetchPolicy,
        expectedInitialFetchPolicy: WatchQueryFetchPolicy,
      ) {
        const { observable } = result.current;
        const {
          fetchPolicy,
          initialFetchPolicy,
        } = observable.options;

        expect(fetchPolicy).toBe(expectedFetchPolicy);
        expect(initialFetchPolicy).toBe(expectedInitialFetchPolicy);
      }

      check(
        "standby",
        correctInitialFetchPolicy,
      );

      rerender({
        skip: false,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.data).toEqual({
        hello: 1,
      });

      check(
        correctInitialFetchPolicy,
        correctInitialFetchPolicy,
      );

      const reasons: string[] = [];

      const reobservePromise = result.current.observable.reobserve({
        variables: {
          newVar: true,
        },
        nextFetchPolicy(currentFetchPolicy, context) {
          expect(currentFetchPolicy).toBe("cache-and-network");
          expect(context.initialFetchPolicy).toBe("cache-and-network");
          reasons.push(context.reason);
          return currentFetchPolicy;
        },
      }).then(result => {
        expect(result.loading).toBe(false);
        expect(result.data).toEqual({ hello: 2 });
      });

      expect(result.current.loading).toBe(false);

      await waitFor(() => {
        expect(result.current.data).toEqual({
          hello: 2,
        });
      }, { interval: 1 });

      await reobservePromise;

      expect(reasons).toEqual([
        "variables-changed",
        "after-fetch",
      ]);
    });
  });

  describe('Missing Fields', () => {
    it('should log debug messages about MissingFieldErrors from the cache', async () => {
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

      const { result } = renderHook(
        () => useQuery(carQuery, { variables: { id: 1 } }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual(carData);
      expect(result.current.error).toBeUndefined();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenLastCalledWith(
        `Missing field 'vin' while writing result ${JSON.stringify({
          id: 1,
          make: "Audi",
          model: "RS8",
          vine: "DOLLADOLLABILL",
          __typename: "Car"
        }, null, 2)}`
      );
      errorSpy.mockRestore();
    });

    it('should return partial cache data when `returnPartialData` is true', async () => {
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      const fullQuery = gql`
        query {
          cars {
            make
            model
            repairs {
              date
              description
            }
          }
        }
      `;

      cache.writeQuery({
        query: fullQuery,
        data: {
          cars: [
            {
              __typename: 'Car',
              make: 'Ford',
              model: 'Mustang',
              vin: 'PONY123',
              repairs: [
                {
                  __typename: 'Repair',
                  date: '2019-05-08',
                  description: 'Could not get after it.',
                },
              ],
            },
          ],
        },
      });

      const partialQuery = gql`
        query {
          cars {
            repairs {
              date
              cost
            }
          }
        }
      `;

      const { result } = renderHook(
        () => useQuery(partialQuery, { returnPartialData: true }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual({
        cars: [
          {
            __typename: 'Car',
            repairs: [
              {
                __typename: 'Repair',
                date: '2019-05-08',
              },
            ],
          },
        ],
      });
    });

    it('should not return partial cache data when `returnPartialData` is false', () => {
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      const fullQuery = gql`
        query {
          cars {
            make
            model
            repairs {
              date
              description
            }
          }
        }
      `;

      cache.writeQuery({
        query: fullQuery,
        data: {
          cars: [
            {
              __typename: 'Car',
              make: 'Ford',
              model: 'Mustang',
              vin: 'PONY123',
              repairs: [
                {
                  __typename: 'Repair',
                  date: '2019-05-08',
                  description: 'Could not get after it.',
                },
              ],
            },
          ],
        },
      });

      const partialQuery = gql`
        query {
          cars {
            repairs {
              date
              cost
            }
          }
        }
      `;

      const { result } = renderHook(
        () => useQuery(partialQuery, { returnPartialData: false }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
    });

    it('should not return partial cache data when `returnPartialData` is false and new variables are passed in', async () => {
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      const query = gql`
        query MyCar($id: ID) {
          car (id: $id) {
            id
            make
          }
        }
      `;

      const partialQuery = gql`
        query MyCar($id: ID) {
          car (id: $id) {
            id
            make
            model
          }
        }
      `;

      cache.writeQuery({
        query,
        variables: { id: 1 },
        data: {
          car: {
            __typename: 'Car',
            id: 1,
            make: 'Ford',
            model: 'Pinto',
          },
        },
      });

      cache.writeQuery({
        query: partialQuery,
        variables: { id: 2 },
        data: {
          car: {
            __typename: 'Car',
            id: 2,
            make: 'Ford',
            model: 'Pinto',
          },
        },
      });


      let setId: any;
      const { result } = renderHook(
        () => {
          const [id, setId1] = React.useState(2);
          setId = setId1;
          return useQuery(partialQuery, {
            variables: { id },
            returnPartialData: false,
            notifyOnNetworkStatusChange: true,
          });
        },
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({
        car: {
          __typename: 'Car',
          id: 2,
          make: 'Ford',
          model: 'Pinto',
        },
      });

      setTimeout(() => {
        setId(1);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });

      expect(result.current.data).toBe(undefined);
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

      const { result } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.previousData).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toBe(undefined);

      setTimeout(() => result.current.refetch());
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toEqual(data1);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      const { result } = renderHook(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        { wrapper },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.previousData).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toBe(undefined);

      setTimeout(() => result.current.refetch());
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      }, { interval: 1 });
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toEqual(data1);

      result.current.refetch({ vin: "ABCDEFG0123456789" });
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual(data1);
      expect(result.current.previousData).toEqual(data1);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual(data3);
      expect(result.current.previousData).toEqual(data1);
    });

    it('should persist result.previousData even if query changes', async () => {
      const aQuery: TypedDocumentNode<{
        a: string;
      }> = gql`query A { a }`;

      const abQuery: TypedDocumentNode<{
        a: string;
        b: number;
      }> = gql`query AB { a b }`;

      const bQuery: TypedDocumentNode<{
        b: number;
      }> = gql`query B { b }`;

      let stringOfAs = "";
      let countOfBs = 0;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(request => new Observable(observer => {
          switch (request.operationName) {
            case "A": {
              observer.next({
                data: {
                  a: stringOfAs += 'a',
                },
              });
              break;
            }
            case "AB": {
              observer.next({
                data: {
                  a: stringOfAs += 'a',
                  b: countOfBs += 1,
                },
              });
              break;
            }
            case "B": {
              observer.next({
                data: {
                  b: countOfBs += 1,
                },
              });
              break;
            }
          }
          setTimeout(() => {
            observer.complete();
          }, 10);
        })),
      });

      const { result } = renderHook(
        () => {
          const [query, setQuery] = useState<DocumentNode>(aQuery);
          return {
            query,
            setQuery,
            useQueryResult: useQuery(query, {
              fetchPolicy: "cache-and-network",
              notifyOnNetworkStatusChange: true,
            }),
          };
        },
        {
          wrapper: ({ children }: any) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );


      await waitFor(() => {
        const { loading } = result.current.useQueryResult;
        expect(loading).toBe(true);
      }, { interval: 1 });
      await waitFor(() => {
        const { data } = result.current.useQueryResult;
        expect(data).toEqual({ a: "a" });
      }, { interval: 1 });
      await waitFor(() => {
        const { previousData } = result.current.useQueryResult;
        expect(previousData).toBeUndefined();
      }, { interval: 1 });


      await waitFor(() => {
        const { loading } = result.current.useQueryResult;
        expect(loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        const { data } = result.current.useQueryResult;
        expect(data).toEqual({ a: "a" });
      }, { interval: 1 });
      await waitFor(() => {
        const { previousData } = result.current.useQueryResult;
        expect(previousData).toBe(undefined);
      }, { interval: 1 });

      await expect(await waitFor(() => {
        result.current.setQuery(abQuery);
      }, { interval: 1 }));

      await waitFor(() => {
        const { loading } = result.current.useQueryResult;
        expect(loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        const { data } = result.current.useQueryResult;
        expect(data).toEqual({ a: "aa", b: 1 });
      }, { interval: 1 });
      await waitFor(() => {
        const { previousData } = result.current.useQueryResult;
        expect(previousData).toEqual({ a: "a" });
      }, { interval: 1 });

      await waitFor(() => {
        const { loading } = result.current.useQueryResult;
        expect(loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        const { data } = result.current.useQueryResult;
        expect(data).toEqual({ a: "aa", b: 1 });
      }, { interval: 1 });
      await waitFor(() => {
        const { previousData } = result.current.useQueryResult;
        expect(previousData).toEqual({ a: "a" });
      }, { interval: 1 });

      await waitFor(() => {
        result.current.useQueryResult.reobserve().then(result => {
          expect(result.loading).toBe(false);
          expect(result.data).toEqual({ a: "aaa", b: 2 });
        });
      }, { interval: 1 });

      await waitFor(() => {
        const { loading } = result.current.useQueryResult;
        expect(loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        const { data } = result.current.useQueryResult;
        expect(data).toEqual({ a: "aaa", b: 2 });
      }, { interval: 1 });
      await waitFor(() => {
        const { previousData } = result.current.useQueryResult;
        expect(previousData).toEqual({ a: "aa", b: 1 });
      }, { interval: 1 });

      await waitFor(() => {
        result.current.setQuery(bQuery);
      }, { interval: 1 });

      await waitFor(() => {
        const { loading } = result.current.useQueryResult;
        expect(loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        const { data } = result.current.useQueryResult;
        expect(data).toEqual({ b: 3 });
      }, { interval: 1 });
      await waitFor(() => {
        const { previousData } = result.current.useQueryResult;
        expect(previousData).toEqual({ b: 2 });
      }, { interval: 1 });
      await waitFor(() => {
        const { loading } = result.current.useQueryResult;
        expect(loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        const { data } = result.current.useQueryResult;
        expect(data).toEqual({ b: 3 });
      }, { interval: 1 });
      await waitFor(() => {
        const { previousData } = result.current.useQueryResult;
        expect(previousData).toEqual({ b: 2 });
      }, { interval: 1 });
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

      const { result, rerender } = renderHook(
        ({ gender }) => useQuery(query, {
          variables: { gender },
          fetchPolicy: 'network-only',
        }),
        { wrapper, initialProps: { gender: 'all' } },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });

      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({
        people: peopleData.map(({ gender, ...person }) => person),
      });

      rerender({ gender: 'female' });
      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.setVariables);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
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

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.data).toEqual({
        people: peopleData
          .filter((person) => person.gender === 'nonbinary')
          .map(({ gender, ...person }) => person),
      });
    });
  });

  describe('defaultOptions', () => {
    it('should allow polling options to be passed to the client', async () => {
      const query = gql`{ hello }`;
      const cache = new InMemoryCache();
      const link = mockSingleLink(
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
      );

      const client = new ApolloClient({
        defaultOptions: {
          watchQuery: {
            pollInterval: 10,
          },
        },
        cache,
        link,
      });

      const { result } = renderHook(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: 'world 1' });
      }, { interval: 1 });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: 'world 2' });
      }, { interval: 1 });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({ hello: 'world 3' });
      }, { interval: 1 });
    });
  });

  describe('canonical cache results', () => {
    it('can be disabled via useQuery options', async () => {
      const cache = new InMemoryCache({
        canonizeResults: true,
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

      const { result, rerender } = renderHook(
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
      await waitFor(() => {
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

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({ results });
      }, { interval: 1 });
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

  describe('canonical cache results', () => {
    it('can be disabled via useQuery options', async () => {
      const cache = new InMemoryCache({
        canonizeResults: true,
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

      const { result, rerender } = renderHook(
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
      await waitFor(() => {
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

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({ results });
      }, { interval: 1 });
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
            switch (operation.operationName) {
              case "A":
                setTimeout(() => {
                  observer.next({ data: aData });
                  observer.complete();
                });
                break;
              case "B":
                setTimeout(() => {
                  observer.next({ data: bData });
                  observer.complete();
                }, 10);
                break;
            }
        })),
      });
    }

    async function check(
      aFetchPolicy: WatchQueryFetchPolicy,
      bFetchPolicy: WatchQueryFetchPolicy,
    ) {
      const client = makeClient();
      const { result } = renderHook(
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

      await waitFor(() => {
        expect(result.current.a.loading).toBe(false);
      });
      await waitFor(() => {
        expect(result.current.b.loading).toBe(false);
      });
      expect(result.current.a.data).toEqual(aData);
      expect(result.current.b.data).toEqual(bData);
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

  describe('regression test issue #9204', () => {
    it('should handle a simple query', async () => {
      const query = gql`{ hello }`;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const Component = ({ query }: any) => {
        const [counter, setCounter] = useState(0)
        const result = useQuery(query)

        useEffect(() => {
          /**
           * IF the return value from useQuery changes on each render,
           * this component will re-render in an infinite loop.
           */
          if (counter > 10) {
            console.error(`Too many results (${counter})`);
          } else {
            setCounter(c => c + 1);
          }
        }, [
          result,
          result.data,
        ]);

        if (result.loading) return null;

        return <div>{result.data.hello}{counter}</div>;
      }

      render(
        <MockedProvider mocks={mocks}>
          <Component query={query} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('world2')).toBeTruthy();
      });
    });
  });

  describe('defer', () => {
    it('should handle deferred queries', async () => {
      const query = gql`
        {
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

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              greeting: {
                message: 'Hello world',
                __typename: 'Greeting',
              },
            },
            hasNext: true
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({
        greeting: {
          message: 'Hello world',
          __typename: 'Greeting',
        },
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            incremental: [{
              data: {
                recipient: {
                  name: 'Alice',
                  __typename: 'Person',
                },
                __typename: 'Greeting',
              },
              path: ['greeting'],
            }],
            hasNext: false
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          greeting: {
            message: 'Hello world',
            __typename: 'Greeting',
            recipient: {
              name: 'Alice',
              __typename: 'Person',
            },
          },
        });
      }, { interval: 1 });
    });

    it('should handle deferred queries in lists', async () => {
      const query = gql`
        {
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

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              greetings: [
                { message: 'Hello world', __typename: 'Greeting' },
                { message: 'Hello again', __typename: 'Greeting' },
              ],
            },
            hasNext: true
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      expect(result.current.data).toEqual({
        greetings: [
          { message: 'Hello world', __typename: 'Greeting' },
          { message: 'Hello again', __typename: 'Greeting' },
        ],
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            incremental: [{
              data: {
                recipient: {
                  name: 'Alice',
                  __typename: 'Person',
                },
                __typename: 'Greeting',
              },
              path: ['greetings', 0],
            }],
            hasNext: true,
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          greetings: [
            {
              message: 'Hello world',
              __typename: 'Greeting',
              recipient: { name: 'Alice', __typename: 'Person' },
            },
            { message: 'Hello again', __typename: 'Greeting' },
          ],
        });
      }, { interval: 1 });

      setTimeout(() => {
        link.simulateResult({
          result: {
            incremental: [{
              data: {
                recipient: {
                  name: 'Bob',
                  __typename: 'Person',
                },
                __typename: 'Greeting',
              },
              path: ['greetings', 1],
            }],
            hasNext: false
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          greetings: [
            {
              message: 'Hello world',
              __typename: 'Greeting',
              recipient: { name: 'Alice', __typename: 'Person' },
            },
            {
              message: 'Hello again',
              __typename: 'Greeting',
              recipient: { name: 'Bob', __typename: 'Person' },
            },
          ],
        });
      }, { interval: 1 });
    });

    it('should handle deferred queries in lists, merging arrays', async () => {
      const query = gql`
        query DeferVariation {
          allProducts {
            delivery {
              ...MyFragment @defer
            }
            sku,
            id
          }
        }
        fragment MyFragment on DeliveryEstimates {
          estimatedDelivery
          fastestDelivery
        }
      `;

      const link = new MockSubscriptionLink();

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              allProducts: [
                {
                  __typename: "Product",
                  delivery: {
                    __typename: "DeliveryEstimates"
                  },
                  id: "apollo-federation",
                  sku: "federation"
                },
                {
                  __typename: "Product",
                  delivery: {
                    __typename: "DeliveryEstimates"
                  },
                  id: "apollo-studio",
                  sku: "studio"
                }
              ]
            },
            hasNext: true
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          allProducts: [
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates"
              },
              id: "apollo-federation",
              sku: "federation"
            },
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates"
              },
              id: "apollo-studio",
              sku: "studio"
            }
          ]
        });
      }, { interval: 1 });

      setTimeout(() => {
        link.simulateResult({
          result: {
            hasNext: true,
            incremental: [
              {
                data: {
                  __typename: "DeliveryEstimates",
                  estimatedDelivery: "6/25/2021",
                  fastestDelivery: "6/24/2021",
                },
                path: [
                  "allProducts",
                  0,
                  "delivery"
                ]
              },
              {
                data: {
                  __typename: "DeliveryEstimates",
                  estimatedDelivery: "6/25/2021",
                  fastestDelivery: "6/24/2021",
                },
                path: [
                  "allProducts",
                  1,
                  "delivery"
                ]
              },
            ]
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          allProducts: [
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
                estimatedDelivery: "6/25/2021",
                fastestDelivery: "6/24/2021"
              },
              id: "apollo-federation",
              sku: "federation"
            },
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
                estimatedDelivery: "6/25/2021",
                fastestDelivery: "6/24/2021"
              },
              id: "apollo-studio",
              sku: "studio"
            }
          ]
        });
      }, { interval: 1 });
    });

    it('should handle deferred queries with fetch policy no-cache', async () => {
      const query = gql`
        {
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

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useQuery(query, {fetchPolicy: 'no-cache'}),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              greeting: {
                message: 'Hello world',
                __typename: 'Greeting',
              },
            },
            hasNext: true
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          greeting: {
            message: 'Hello world',
            __typename: 'Greeting',
          },
        });
      }, { interval: 1 });

      setTimeout(() => {
        link.simulateResult({
          result: {
            incremental: [{
              data: {
                recipient: {
                  name: 'Alice',
                  __typename: 'Person',
                },
                __typename: 'Greeting',
              },
              path: ['greeting'],
            }],
            hasNext: false
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          greeting: {
            message: 'Hello world',
            __typename: 'Greeting',
            recipient: {
              name: 'Alice',
              __typename: 'Person',
            },
          },
        });
      }, { interval: 1 });
    });

    it('should handle deferred queries with errors returned on the incremental batched result', async () => {
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

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              hero: {
                name: "R2-D2",
                heroFriends: [
                  {
                    id: "1000",
                    name: "Luke Skywalker"
                  },
                  {
                    id: "1003",
                    name: "Leia Organa"
                  }
                ]
              }
            },
            hasNext: true
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker'
              },
              {
                id: '1003',
                name: 'Leia Organa'
              },
            ],
            name: "R2-D2"
          }
        });
      }, { interval: 1 });

      setTimeout(() => {
        link.simulateResult({
          result: {
            incremental: [
              {
                path: ["hero", "heroFriends", 0],
                errors: [
                  new GraphQLError(
                    "homeWorld for character with ID 1000 could not be fetched.",
                    { path: ["hero", "heroFriends", 0, "homeWorld"] }
                  )
                ],
                data: {
                  "homeWorld": null,
                }
              },
              {
                path: ["hero", "heroFriends", 1],
                data: {
                  "homeWorld": "Alderaan",
                }
              },
            ],
            "hasNext": false
          }
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(ApolloError);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.error!.message).toBe('homeWorld for character with ID 1000 could not be fetched.');
      }, { interval: 1 });
      await waitFor(() => {
        // since default error policy is "none", we do *not* return partial results
        expect(result.current.data).toEqual({
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker'
              },
              {
                id: '1003',
                name: 'Leia Organa'
              },
            ],
            name: "R2-D2"
          }
        });
      }, { interval: 1 });
    });

    it('should handle deferred queries with errors returned on the incremental batched result and errorPolicy "all"', async () => {
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

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useQuery(query, { errorPolicy: "all" }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              hero: {
                name: "R2-D2",
                heroFriends: [
                  {
                    id: "1000",
                    name: "Luke Skywalker"
                  },
                  {
                    id: "1003",
                    name: "Leia Organa"
                  }
                ]
              }
            },
            hasNext: true
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          hero: {
            heroFriends: [
              {
                id: '1000',
                name: 'Luke Skywalker'
              },
              {
                id: '1003',
                name: 'Leia Organa'
              },
            ],
            name: "R2-D2"
          }
        });
      }, { interval: 1 });

      setTimeout(() => {
        link.simulateResult({
          result: {
            extensions: {
              thing1: 'foo',
              thing2: 'bar',
            },
            incremental: [
              {
                path: ["hero", "heroFriends", 0],
                errors: [
                  new GraphQLError(
                    "homeWorld for character with ID 1000 could not be fetched.",
                    { path: ["hero", "heroFriends", 0, "homeWorld"] }
                  )
                ],
                data: {
                  "homeWorld": null,
                }
              },
              {
                path: ["hero", "heroFriends", 1],
                data: {
                  "homeWorld": "Alderaan",
                }
              },
            ],
            "hasNext": false
          }
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        // @ts-ignore
        expect(result.current.label).toBe(undefined);
      }, { interval: 1 });
      await waitFor(() => {
        // @ts-ignore
        expect(result.current.extensions).toBe(undefined);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(ApolloError);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.error!.message).toBe('homeWorld for character with ID 1000 could not be fetched.');
      }, { interval: 1 });
      await waitFor(() => {
        // since default error policy is "all", we *do* return partial results
        expect(result.current.data).toEqual({
          hero: {
            heroFriends: [
              {
                // the only difference with the previous test
                // is that homeWorld is populated since errorPolicy: all
                // populates both partial data and error.graphQLErrors
                homeWorld: null,
                id: '1000',
                name: 'Luke Skywalker'
              },
              {
                // homeWorld is populated due to errorPolicy: all
                homeWorld: "Alderaan",
                id: '1003',
                name: 'Leia Organa'
              },
            ],
            name: "R2-D2"
          }
        });
      }, { interval: 1 });
    });

    it('returns eventually consistent data from deferred queries with data in the cache while using a "cache-and-network" fetch policy', async () => {
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

      const { result } = renderHook(
        () => useQuery(query, { fetchPolicy: 'cache-and-network' }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        }
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toEqual({
        greeting: {
          message: 'Hello cached',
          __typename: 'Greeting',
          recipient: { __typename: 'Person', name: 'Cached Alice' },
        },
      });

      link.simulateResult({
        result: {
          data: { greeting: { __typename: 'Greeting', message: 'Hello world' } },
          hasNext: true,
        },
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Cached Alice' },
          },
        });
      }, { interval: 1 });

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
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Alice' },
          },
        });
      }, { interval: 1 });
    });

    it('returns eventually consistent data from deferred queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
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
      const link = new MockSubscriptionLink();
      const client = new ApolloClient({ cache, link });

      // We know we are writing partial data to the cache so suppress the console
      // warning.
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      cache.writeQuery({
        query,
        data: {
          greeting: {
            __typename: 'Greeting',
            recipient: { __typename: 'Person', name: 'Cached Alice' },
          },
        },
      });
      consoleSpy.mockRestore();

      const { result } = renderHook(
        () =>
          useQuery(query, {
            fetchPolicy: 'cache-first',
            returnPartialData: true
          }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        }
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.data).toEqual({
        greeting: {
          __typename: 'Greeting',
          recipient: { __typename: 'Person', name: 'Cached Alice' },
        },
      });

      link.simulateResult({
        result: {
          data: { greeting: { message: 'Hello world', __typename: 'Greeting' } },
          hasNext: true,
        },
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Cached Alice' },
          },
        });
      }, { interval: 1 });

      link.simulateResult({
        result: {
          incremental: [
            {
              data: {
                __typename: 'Greeting',
                recipient: { name: 'Alice', __typename: 'Person' },
              },
              path: ['greeting'],
            },
          ],
          hasNext: false,
        },
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.networkStatus).toBe(NetworkStatus.ready);
      }, { interval: 1 });
      await waitFor(() => {
        expect(result.current.data).toEqual({
          greeting: {
            __typename: 'Greeting',
            message: 'Hello world',
            recipient: { __typename: 'Person', name: 'Alice' },
          },
        });
      }, { interval: 1 });
    });
  });

  describe("interaction with `disableNetworkFetches`", () => {
    const cacheData = { something: "foo" };
    const emptyData = undefined;
    type TestQueryValue = typeof cacheData;

    test.each<
      [
        fetchPolicy: WatchQueryFetchPolicy,
        initialQueryValue: TestQueryValue | undefined,
        shouldFetchOnFirstRender: boolean,
        shouldFetchOnSecondRender: boolean
      ]
    >([
      [`cache-first`, emptyData, true, false],
      [`cache-first`, cacheData, false, false],
      [`cache-only`, emptyData, false, false],
      [`cache-only`, cacheData, false, false],
      [`cache-and-network`, emptyData, true, false],
      [`cache-and-network`, cacheData, false, false],
      [`network-only`, emptyData, true, false],
      [`network-only`, cacheData, false, false],
      [`no-cache`, emptyData, true, false],
      [`no-cache`, cacheData, true, false],
      [`standby`, emptyData, false, false],
      [`standby`, cacheData, false, false],
    ])(
      "fetchPolicy %s, cache: %p should fetch during `disableNetworkFetches`: %p and after `disableNetworkFetches` has been disabled: %p",
      async (policy, initialQueryValue, shouldFetchOnFirstRender, shouldFetchOnSecondRender) => {
        const query: TypedDocumentNode<TestQueryValue> = gql`
          query CallMe {
            something
          }
        `;

        const link = new MockLink([
          {request: {query}, result: {data: { something: "bar" }}},
          {request: {query}, result: {data: { something: "baz" }}},
        ]);
        const requestSpy = jest.spyOn(link, 'request');

        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link,
        });
        if (initialQueryValue) {
          client.writeQuery({ query, data: initialQueryValue });
        }
        client.disableNetworkFetches = true;

        const { rerender } = renderHook(
          () => useQuery(query, { fetchPolicy: policy, nextFetchPolicy: policy }),
          {
            wrapper: ({ children }) => <ApolloProvider client={client}>{children}</ApolloProvider>,
          }
        );

        expect(requestSpy).toHaveBeenCalledTimes(shouldFetchOnFirstRender ? 1 : 0);

        // We need to wait a moment before the rerender for everything to settle down.
        // This part is unfortunately bound to be flaky - but in some cases there is 
        // just nothing to "wait for", except "a moment".
        await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

        requestSpy.mockClear();
        client.disableNetworkFetches = false;

        rerender();
        expect(requestSpy).toHaveBeenCalledTimes(shouldFetchOnSecondRender ? 1 : 0);
      }
    );
  });
});
