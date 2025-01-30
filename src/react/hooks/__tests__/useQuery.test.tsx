import React, { Fragment, ReactNode, useEffect, useState } from "react";
import { DocumentNode, GraphQLError, GraphQLFormattedError } from "graphql";
import gql from "graphql-tag";
import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import {
  ApolloClient,
  ApolloError,
  ApolloQueryResult,
  FetchPolicy,
  NetworkStatus,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "../../../core";
import { InMemoryCache } from "../../../cache";
import { ApolloProvider } from "../../context";
import { Observable, Reference, concatPagination } from "../../../utilities";
import { ApolloLink } from "../../../link/core";
import {
  MockLink,
  MockedProvider,
  MockSubscriptionLink,
  mockSingleLink,
  tick,
  wait,
  MockedResponse,
} from "../../../testing";
import { QueryResult } from "../../types/types";
import { useQuery } from "../useQuery";
import { useMutation } from "../useMutation";
import { setupPaginatedCase, spyOnConsole } from "../../../testing/internal";
import { useLazyQuery } from "../useLazyQuery";
import { mockFetchQuery } from "../../../core/__tests__/ObservableQuery";
import { InvariantError } from "../../../utilities/globals";
import { Unmasked } from "../../../masking";
import {
  createRenderStream,
  renderHookToSnapshotStream,
  disableActEnvironment,
} from "@testing-library/react-render-stream";

const IS_REACT_17 = React.version.startsWith("17");
const IS_REACT_18 = React.version.startsWith("18");

describe("useQuery Hook", () => {
  describe("General use", () => {
    it("should handle a simple query", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          loading: true,
          networkStatus: NetworkStatus.loading,
          called: true,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          loading: false,
          networkStatus: NetworkStatus.ready,
          called: true,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("useQuery result is referentially stable", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        () => useQuery(query),
        {
          wrapper,
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      let oldResult: QueryResult<any, OperationVariables>;

      {
        const result = (oldResult = await takeSnapshot());

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await rerender({ children: null });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });

        expect(result).toBe(oldResult);
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("useQuery produces the expected renders initially", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        () => useQuery(query),
        {
          wrapper,
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await rerender({ children: null });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("useQuery produces the expected frames when variables change", async () => {
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
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        (options) => useQuery(query, options),
        { wrapper, initialProps: { variables: { id: 1 } } }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      await rerender({ variables: { id: 2 } });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: { hello: "world 1" },
          variables: { id: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: { id: 2 },
        });
      }
    });

    // TODO: Refactor this test. This test does not test the thing it says it
    // does as there is no cache interaction in this test. This is essentially
    // just a repeat of prior tests that rerender and check the result.
    it("should read and write results from the cache", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        () => useQuery(query),
        {
          wrapper,
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await rerender(undefined);

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }
    });

    it("should preserve functions between renders", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        () => useQuery(query),
        { wrapper }
      );

      const {
        loading,
        refetch,
        fetchMore,
        startPolling,
        stopPolling,
        subscribeToMore,
      } = await takeSnapshot();
      expect(loading).toBe(true);

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });

        expect(refetch).toBe(result.refetch);
        expect(fetchMore).toBe(result.fetchMore);
        expect(startPolling).toBe(result.startPolling);
        expect(stopPolling).toBe(result.stopPolling);
        expect(subscribeToMore).toBe(result.subscribeToMore);
      }

      await rerender(undefined);

      {
        const result = await takeSnapshot();

        expect(refetch).toBe(result.refetch);
        expect(fetchMore).toBe(result.fetchMore);
        expect(startPolling).toBe(result.startPolling);
        expect(stopPolling).toBe(result.stopPolling);
        expect(subscribeToMore).toBe(result.subscribeToMore);
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("should set called to true by default", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        { wrapper }
      );

      const { called } = await takeSnapshot();

      expect(called).toBe(true);
    });

    it("should set called to false when skip option is true", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { skip: true }),
        { wrapper }
      );

      const { called } = await takeSnapshot();

      expect(called).toBe(false);
    });

    // TODO: Remove this test after PR is reviewed since this is basically a
    // duplicate of "useQuery produces the expected frames when variables change"
    it("should work with variables", async () => {
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
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ id }) => useQuery(query, { variables: { id } }),
        { wrapper, initialProps: { id: 1 } }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      await rerender({ id: 2 });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: { hello: "world 1" },
          variables: { id: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: { id: 2 },
        });
      }
    });

    it("should return the same results for the same variables", async () => {
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
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ id }) => useQuery(query, { variables: { id } }),
        { wrapper, initialProps: { id: 1 } }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      await rerender({ id: 2 });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: { hello: "world 1" },
          variables: { id: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: { id: 2 },
        });
      }

      await rerender({ id: 2 });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: { id: 2 },
        });
      }
    });

    it("should work with variables 2", async () => {
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
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ name }) => useQuery(query, { variables: { name } }),
        { wrapper, initialProps: { name: "" } }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { name: "" },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { names: ["Alice", "Bob", "Eve"] },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { name: "" },
        });
      }

      await rerender({ name: "z" });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: { names: ["Alice", "Bob", "Eve"] },
          variables: { name: "z" },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { names: [] },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { names: ["Alice", "Bob", "Eve"] },
          variables: { name: "z" },
        });
      }

      await rerender({ name: "zz" });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: { names: [] },
          variables: { name: "zz" },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { names: [] },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { names: [] },
          variables: { name: "zz" },
        });
      }
    });

    // An unsuccessful attempt to reproduce https://github.com/apollographql/apollo-client/issues/9135.
    it("should not return stale variables when stored in state", async () => {
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

      using _disabledAct = disableActEnvironment();
      // TODO: Take a deeper look into this to better understand what this is
      // trying to test. There are a few problems with this:
      //
      // 1. We execute the mutation and a setState at the same time. What is
      //    that meant to accomplish?
      // 2. The update callback in the useMutation is writing data for none of
      //    the results in the mocks. The mutation returns `updateName: true`,
      //    yet the callback is trying to set a value from `data.updateGreeting`
      // 3. The update callback in `useMutation` does not use `variables`, so
      //    the written cache result does not affect any of the queries from the
      //    `useQuery` returned here.
      //
      // My recommendation is to just delete the `useMutation` as part of this
      // render callback as it doesn't seem to serve much of a purpose for this
      // test.
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => {
            const [name, setName1] = React.useState("world 1");
            setName = setName1;
            return [
              useQuery(query, { variables: { name } }),
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
          }
        );

      {
        const [useQueryResult] = await takeSnapshot();

        expect(useQueryResult).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { name: "world 1" },
        });
      }

      {
        const [useQueryResult] = await takeSnapshot();

        expect(useQueryResult).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { name: "world 1" },
        });
      }

      const [, [mutate]] = getCurrentSnapshot();

      void mutate({ variables: { name: "world 2" } });
      setName("world 2");

      if (IS_REACT_17) {
        {
          const [useQueryResult] = await takeSnapshot();

          expect(useQueryResult).toEqualQueryResult({
            data: { hello: "world 1" },
            called: true,
            loading: false,
            networkStatus: NetworkStatus.ready,
            previousData: undefined,
            variables: { name: "world 1" },
          });
        }

        {
          const [useQueryResult] = await takeSnapshot();

          expect(useQueryResult).toEqualQueryResult({
            data: undefined,
            called: true,
            loading: true,
            networkStatus: NetworkStatus.setVariables,
            previousData: { hello: "world 1" },
            variables: { name: "world 2" },
          });
        }
      }

      {
        const [useQueryResult] = await takeSnapshot();

        expect(useQueryResult).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: { hello: "world 1" },
          variables: { name: "world 2" },
        });
      }

      {
        const [useQueryResult] = await takeSnapshot();

        expect(useQueryResult).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: { name: "world 2" },
        });
      }

      if (IS_REACT_18) {
        const [useQueryResult] = await takeSnapshot();

        expect(useQueryResult).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: { name: "world 2" },
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    // TODO: Rewrite this test
    // Context: https://legacy.reactjs.org/blog/2020/02/26/react-v16.13.0.html#warnings-for-some-updates-during-render
    it("should not error when forcing an update with React >= 16.13.0", async () => {
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
            make: "Audi",
            model: "RS8",
            vin: "DOLLADOLLABILL",
            __typename: "Car",
          },
        ],
      };
      let wasUpdateErrorLogged = false;
      const consoleError = console.error;
      console.error = (msg: string) => {
        console.log(msg);
        wasUpdateErrorLogged = msg.indexOf("Cannot update a component") > -1;
      };

      const CAR_MOCKS = [1, 2, 3, 4, 5, 6].map((something) => ({
        request: {
          query: CAR_QUERY,
          variables: { something },
        },
        result: { data: CAR_RESULT_DATA },
      }));

      let renderCount = 0;

      const InnerComponent = ({ something }: any) => {
        const { loading, data } = useQuery(CAR_QUERY, {
          fetchPolicy: "network-only",
          variables: { something },
        });
        renderCount += 1;
        if (loading) return null;
        expect(wasUpdateErrorLogged).toBeFalsy();
        expect(data).toEqual(CAR_RESULT_DATA);
        return null;
      };

      function WrapperComponent({ something }: any) {
        const { loading } = useQuery(CAR_QUERY, {
          variables: { something },
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
      });
      console.error = consoleError;
    });

    it("should tear down the query on unmount", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const client = new ApolloClient({
        link: new ApolloLink(() => Observable.of({ data: { hello: "world" } })),
        cache: new InMemoryCache(),
      });

      const wrapper = ({ children }: any) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      );

      const { unmount } = renderHook(() => useQuery(query), { wrapper });

      expect(client.getObservableQueries().size).toBe(1);
      unmount();
      await new Promise((resolve) => setTimeout(resolve));
      expect(client.getObservableQueries().size).toBe(0);
    });

    it("should work with ssr: false", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { ssr: false }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }
    });

    it("should keep `no-cache` results when the tree is re-rendered", async () => {
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
        allPeople: { people: [{ name: "Luke Skywalker" }] },
      };

      const allThingsData = {
        allThings: {
          thing: [{ description: "Thing 1" }, { description: "Thing 2" }],
        },
      };

      const link = mockSingleLink(
        {
          request: { query: query1 },
          result: { data: allPeopleData },
          delay: 3,
        },
        {
          request: { query: query2 },
          result: { data: allThingsData },
          delay: 50,
        }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        () => [useQuery(query1, { fetchPolicy: "no-cache" }), useQuery(query2)],
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      {
        const [result0, result1] = await takeSnapshot();

        expect(result0).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });

        expect(result1).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const [result0, result1] = await takeSnapshot();

        expect(result0).toEqualQueryResult({
          data: allPeopleData,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });

        expect(result1).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const [result0, result1] = await takeSnapshot();

        expect(result0).toEqualQueryResult({
          data: allPeopleData,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });

        expect(result1).toEqualQueryResult({
          data: allThingsData,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await rerender({});

      {
        const [result0, result1] = await takeSnapshot();

        expect(result0).toEqualQueryResult({
          data: allPeopleData,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });

        expect(result1).toEqualQueryResult({
          data: allThingsData,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("changing queries", async () => {
      const query1 = gql`
        query {
          hello
        }
      `;
      const query2 = gql`
        query {
          hello
          name
        }
      `;
      const mocks = [
        {
          request: { query: query1 },
          result: { data: { hello: "world" } },
          delay: 20,
        },
        {
          request: { query: query2 },
          result: { data: { hello: "world", name: "world" } },
          delay: 20,
          maxUsageCount: Number.POSITIVE_INFINITY,
        },
      ];

      const cache = new InMemoryCache();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        // TODO: I don't think this needs to be a polling query as it has
        // nothing to do with this test. This test checks to ensure that
        // changing queries executes the new query and returns the right value.
        // We should consider removing the pollling from this test and save it
        // for a polling-specific test instead.
        ({ query }) => useQuery(query, { pollInterval: 10 }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
          initialProps: { query: query1 },
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      await rerender({ query: query2 });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: mocks[1].result.data,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      // We do not include expect(takeSnapshot).not.toRerender() here because
      // this is a polling query.
    });

    it("`cache-and-network` fetch policy", async () => {
      const query = gql`
        {
          hello
        }
      `;

      const cache = new InMemoryCache();
      const link = mockSingleLink({
        request: { query },
        result: { data: { hello: "from link" } },
        delay: 20,
      });

      const client = new ApolloClient({
        link,
        cache,
      });

      cache.writeQuery({ query, data: { hello: "from cache" } });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { fetchPolicy: "cache-and-network" }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      // TODO: FIXME
      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "from cache" },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "from link" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "from cache" },
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("should not use the cache when using `network-only`", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "from link" } },
        },
      ];

      const cache = new InMemoryCache();
      cache.writeQuery({
        query,
        data: { hello: "from cache" },
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { fetchPolicy: "network-only" }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "from link" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    // TODO: Move this to ssr useQuery tests
    it("should use the cache when in ssrMode and fetchPolicy is `network-only`", async () => {
      const query = gql`
        query {
          hello
        }
      `;
      const link = mockSingleLink({
        request: { query },
        result: { data: { hello: "from link" } },
      });

      const cache = new InMemoryCache();
      cache.writeQuery({
        query,
        data: { hello: "from cache" },
      });

      const client = new ApolloClient({ link, cache, ssrMode: true });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { fetchPolicy: "network-only" }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "from cache" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    // TODO: Move this to ssr useQuery tests
    it("should not hang when ssrMode is true but the cache is not populated for some reason", async () => {
      const query = gql`
        query {
          hello
        }
      `;
      const link = mockSingleLink({
        request: { query },
        result: { data: { hello: "from link" } },
      });

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
        ssrMode: true,
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "from link" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });
  });

  describe("options.defaultOptions", () => {
    it("can provide a default fetchPolicy", async () => {
      const query = gql`
        query {
          hello
        }
      `;
      const link = mockSingleLink({
        request: { query },
        result: { data: { hello: "from link" } },
        delay: 20,
      });

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      let defaultFetchPolicy: WatchQueryFetchPolicy = "cache-and-network";

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => {
          const result = useQuery(query, {
            defaultOptions: {
              fetchPolicy: defaultFetchPolicy,
            },
          });
          return {
            result,
            fetchPolicy: result.observable.options.fetchPolicy,
            defaultFetchPolicy,
          };
        },
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      {
        const { result, fetchPolicy, defaultFetchPolicy } =
          await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });

        expect(fetchPolicy).toBe("cache-and-network");
        expect(defaultFetchPolicy).toBe("cache-and-network");
      }

      // Change the default fetchPolicy to verify that it is not used the second
      // time useQuery is called.
      defaultFetchPolicy = "network-only";

      {
        const { result, fetchPolicy, defaultFetchPolicy } =
          await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "from link" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });

        expect(fetchPolicy).toBe("cache-and-network");
        expect(defaultFetchPolicy).toBe("network-only");
      }
    });

    it("can provide individual default variables", async () => {
      const query: TypedDocumentNode<
        {
          vars: OperationVariables;
        },
        OperationVariables
      > = gql`
        query VarsQuery {
          vars
        }
      `;

      const client = new ApolloClient({
        link: new ApolloLink(
          (request) =>
            new Observable((observer) => {
              setTimeout(() => {
                observer.next({
                  data: {
                    vars: request.variables,
                  },
                });
                observer.complete();
              }, 20);
            })
        ),

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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
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

            return {
              result,
              // Provide a snapshot of these values for this render, rather
              // than checking the mutable value on result.observable.
              fetchPolicy: result.observable.options.fetchPolicy,
              variables: result.observable.variables,
            };
          },
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      {
        const { result, fetchPolicy, variables } = await takeSnapshot();
        const { observable } = result;

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {
            sourceOfVar: "local",
            isGlobal: false,
            mandatory: true,
          },
        });

        expect(variables).toEqual({
          sourceOfVar: "local",
          isGlobal: false,
          mandatory: true,
        });
        expect(fetchPolicy).toBe("cache-and-network");
        expect(
          // The defaultOptions field is for useQuery options (QueryHookOptions),
          // not the more general WatchQueryOptions that ObservableQuery sees.
          "defaultOptions" in observable.options
        ).toBe(false);
      }

      {
        const { result, fetchPolicy, variables } = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            vars: { sourceOfVar: "local", isGlobal: false, mandatory: true },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {
            sourceOfVar: "local",
            isGlobal: false,
            mandatory: true,
          },
        });

        expect(variables).toEqual({
          sourceOfVar: "local",
          isGlobal: false,
          mandatory: true,
        });
        expect(fetchPolicy).toBe("cache-and-network");
      }

      const {
        result: { observable },
      } = getCurrentSnapshot();
      const finalResult = await observable.reobserve({
        fetchPolicy: "network-only",
        nextFetchPolicy: "cache-first",
        variables: {
          // Since reobserve replaces the variables object rather than merging
          // the individual variables together, we need to include the current
          // variables manually if we want them to show up in the output below.
          ...observable.variables,
          sourceOfVar: "reobserve",
        },
      });

      expect(finalResult).toEqualApolloQueryResult({
        data: {
          vars: {
            sourceOfVar: "reobserve",
            isGlobal: false,
            mandatory: true,
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      {
        const { result, fetchPolicy, variables } = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            vars: {
              sourceOfVar: "reobserve",
              isGlobal: false,
              mandatory: true,
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: {
            vars: { sourceOfVar: "local", isGlobal: false, mandatory: true },
          },
          variables: {
            sourceOfVar: "reobserve",
            isGlobal: false,
            mandatory: true,
          },
        });

        expect(variables).toEqual({
          sourceOfVar: "reobserve",
          isGlobal: false,
          mandatory: true,
        });
        expect(fetchPolicy).toBe("cache-first");
      }

      const finalResultNoVarMerge =
        await getCurrentSnapshot().result.observable.reobserve({
          fetchPolicy: "network-only",
          nextFetchPolicy: "cache-first",
          variables: {
            // This reobservation is like the one above, with no variable merging.
            // ...result.current.observable.variables,
            sourceOfVar: "reobserve without variable merge",
          },
        });

      expect(finalResultNoVarMerge).toEqualApolloQueryResult({
        // Since we didn't merge in result.current.observable.variables, we
        // don't see these variables anymore:
        // isGlobal: false,
        // mandatory: true,
        data: { vars: { sourceOfVar: "reobserve without variable merge" } },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      {
        const { result, fetchPolicy, variables } = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            vars: {
              sourceOfVar: "reobserve without variable merge",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: {
            vars: {
              sourceOfVar: "reobserve",
              isGlobal: false,
              mandatory: true,
            },
          },
          variables: {
            sourceOfVar: "reobserve without variable merge",
          },
        });

        expect(variables).toEqual({
          sourceOfVar: "reobserve without variable merge",
        });
        expect(fetchPolicy).toBe("cache-first");
      }

      await expect(takeSnapshot).not.toRerender();
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
        link: new ApolloLink(
          (request) =>
            new Observable((observer) => {
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
                observer.error(
                  new Error(
                    `Unknown query: ${request.operationName || request.query}`
                  )
                );
              }
            })
        ),
      });

      const defaultFetchPolicy = "network-only";

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => {
            const [skip, setSkip] = useState(true);
            const result = useQuery(query, {
              skip,
              defaultOptions: {
                fetchPolicy: defaultFetchPolicy,
              },
            });

            return {
              setSkip,
              query: result,
              fetchPolicy: result.observable.options.fetchPolicy,
            };
          },
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      {
        const { query } = await takeSnapshot();

        expect(query).toEqualQueryResult({
          data: undefined,
          error: undefined,
          called: false,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      getCurrentSnapshot().setSkip(false);

      {
        const { query } = await takeSnapshot();

        expect(query).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const { query, fetchPolicy } = await takeSnapshot();

        expect(query).toEqualQueryResult({
          data: { counter: 1 },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });

        expect(fetchPolicy).toBe(defaultFetchPolicy);
      }

      getCurrentSnapshot().setSkip(true);

      {
        const { query, fetchPolicy } = await takeSnapshot();

        expect(query).toEqualQueryResult({
          // TODO: wut?
          data: undefined,
          // TODO: wut?
          called: false,
          error: undefined,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { counter: 1 },
          variables: {},
        });

        expect(fetchPolicy).toBe("standby");
      }

      getCurrentSnapshot().setSkip(false);

      {
        const { query, fetchPolicy } = await takeSnapshot();

        expect(query).toEqualQueryResult({
          // TODO: wut?
          data: { counter: 1 },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: { counter: 1 },
          variables: {},
        });

        expect(fetchPolicy).toBe(defaultFetchPolicy);
      }

      {
        const { query, fetchPolicy } = await takeSnapshot();

        expect(query).toEqualQueryResult({
          data: { counter: 2 },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { counter: 1 },
          variables: {},
        });

        expect(fetchPolicy).toBe(defaultFetchPolicy);
      }
    });
  });

  it("can provide options.client without ApolloProvider", async () => {
    const query = gql`
      query {
        hello
      }
    `;
    const link = mockSingleLink({
      request: { query },
      result: { data: { hello: "from link" } },
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
      // TODO: is this really needed for this test?
      ssrMode: true,
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { client })
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

    {
      const result = await takeSnapshot();

      expect(result).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const result = await takeSnapshot();

      expect(result).toEqualQueryResult({
        data: { hello: "from link" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }
  });

  describe("<React.StrictMode>", () => {
    it("double-rendering should not trigger duplicate network requests", async () => {
      const query: TypedDocumentNode<{
        linkCount: number;
      }> = gql`
        query Counter {
          linkCount
        }
      `;

      let linkCount = 0;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          (request) =>
            new Observable((observer) => {
              if (request.operationName === "Counter") {
                observer.next({
                  data: {
                    linkCount: ++linkCount,
                  },
                });
                observer.complete();
              }
            })
        ),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              fetchPolicy: "cache-and-network",
            }),
          {
            wrapper: ({ children }) => (
              <React.StrictMode>
                <ApolloProvider client={client}>{children}</ApolloProvider>
              </React.StrictMode>
            ),
          }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { linkCount: 1 },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      function checkObservableQueries(expectedLinkCount: number) {
        const obsQueries = client.getObservableQueries("all");
        const { observable } = getCurrentSnapshot();
        expect(obsQueries.size).toBe(2);

        const activeSet = new Set<typeof observable>();
        const inactiveSet = new Set<typeof observable>();
        obsQueries.forEach((obsQuery) => {
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
        expect(inactiveSet.size).toBe(obsQueries.size - activeSet.size);
      }

      checkObservableQueries(1);

      await expect(
        getCurrentSnapshot().observable.reobserve()
      ).resolves.toEqualApolloQueryResult({
        data: { linkCount: 2 },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { linkCount: 1 },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: { linkCount: 1 },
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { linkCount: 2 },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { linkCount: 1 },
          variables: {},
        });
      }

      checkObservableQueries(2);

      await expect(takeSnapshot).not.toRerender();
    });
  });

  describe("polling", () => {
    it("should support polling", async () => {
      const query = gql`
        {
          hello
        }
      `;
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
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { pollInterval: 10 }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 3" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 2" },
          variables: {},
        });
      }

      getCurrentSnapshot().stopPolling();

      await expect(takeSnapshot).not.toRerender();
    });

    // TODO: Refactor the initial state of this test. This test states that
    // `skip` goes from `true` -> `false`, but it starts out unskipped before
    // enabling it.
    it("should start polling when skip goes from true to false", async () => {
      const query = gql`
        {
          hello
        }
      `;
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
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ skip }: { skip?: boolean }) =>
          useQuery(query, { pollInterval: 10, skip }),
        {
          initialProps: {},
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await rerender({ skip: true });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          // TODO: wut?
          data: undefined,
          // TODO: wut?
          called: false,
          // TODO: wut?
          error: undefined,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender({ timeout: 100 });

      await rerender({ skip: false });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 3" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 2" },
          variables: {},
        });
      }
    });

    // TODO: Move out of "polling" query tests since this doesn't test polling
    it("should return data from network when clients default fetch policy set to network-only", async () => {
      const query = gql`
        {
          hello
        }
      `;
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("should stop polling when component unmounts", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks: MockedResponse[] = [
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
      const requestSpy = jest.spyOn(link, "request");
      const onErrorFn = jest.fn();
      link.setOnError(onErrorFn);
      const wrapper = ({ children }: any) => (
        <MockedProvider link={link} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, unmount } = await renderHookToSnapshotStream(
        () => useQuery(query, { pollInterval: 20 }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
        expect(requestSpy).toHaveBeenCalled();
      }

      const requestCount = requestSpy.mock.calls.length;
      expect(requestCount).toBeGreaterThan(0);

      unmount();

      expect(requestSpy).toHaveBeenCalledTimes(requestCount);

      await expect(
        waitFor(
          () => {
            const newRequestCount = requestSpy.mock.calls.length;
            expect(newRequestCount).toBeGreaterThan(requestCount);
          },
          { interval: 1, timeout: 40 }
        )
      ).rejects.toThrow();

      await waitFor(() => {
        expect(onErrorFn).toHaveBeenCalledTimes(0);
      });

      requestSpy.mockRestore();
    });

    // https://github.com/apollographql/apollo-client/issues/9431
    // https://github.com/apollographql/apollo-client/issues/11750
    it("stops polling when component unmounts with cache-and-network fetch policy", async () => {
      jest.useFakeTimers();
      const query: TypedDocumentNode<{ hello: string }> = gql`
        query {
          hello
        }
      `;

      const mocks: MockedResponse[] = [
        {
          request: { query },
          result: { data: { hello: "world 1" } },
          delay: 20,
        },
        {
          request: { query },
          result: { data: { hello: "world 2" } },
          delay: 20,
        },
        {
          request: { query },
          result: { data: { hello: "world 3" } },
          delay: 20,
        },
      ];

      const cache = new InMemoryCache();

      const link = new MockLink(mocks);
      const requestSpy = jest.spyOn(link, "request");
      const onErrorFn = jest.fn();
      link.setOnError(onErrorFn);

      const client = new ApolloClient({
        queryDeduplication: false,
        link,
        cache,
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, unmount } = await renderHookToSnapshotStream(
        () =>
          useQuery(query, {
            pollInterval: 100,
            fetchPolicy: "cache-and-network",
          }),
        {
          wrapper: ({ children }: any) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      {
        const promise = takeSnapshot();
        await jest.advanceTimersByTimeAsync(0);

        await expect(promise).resolves.toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      jest.advanceTimersByTime(20);

      {
        const promise = takeSnapshot();
        await jest.advanceTimersByTimeAsync(0);

        await expect(promise).resolves.toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
        expect(requestSpy).toHaveBeenCalledTimes(1);
      }

      jest.advanceTimersByTime(100);

      {
        const promise = takeSnapshot();
        await jest.advanceTimersByTimeAsync(0);

        await expect(promise).resolves.toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });
        expect(requestSpy).toHaveBeenCalledTimes(2);
      }

      unmount();

      jest.advanceTimersByTime(200);

      expect(requestSpy).toHaveBeenCalledTimes(2);
      expect(onErrorFn).toHaveBeenCalledTimes(0);

      jest.useRealTimers();
    });

    it("should stop polling when component is unmounted in Strict Mode", async () => {
      const query = gql`
        {
          hello
        }
      `;
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
      const requestSpy = jest.spyOn(link, "request");
      const onErrorFn = jest.fn();
      link.setOnError(onErrorFn);
      const wrapper = ({ children }: any) => (
        <React.StrictMode>
          <MockedProvider link={link} cache={cache}>
            {children}
          </MockedProvider>
        </React.StrictMode>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, unmount } = await renderHookToSnapshotStream(
        () => useQuery(query, { pollInterval: 10 }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      const requestSpyCallCount = requestSpy.mock.calls.length;
      expect(requestSpy).toHaveBeenCalledTimes(requestSpyCallCount);

      unmount();

      expect(requestSpy).toHaveBeenCalledTimes(requestSpyCallCount);
      await expect(
        waitFor(
          () => {
            expect(requestSpy).toHaveBeenCalledTimes(requestSpyCallCount + 1);
          },
          { interval: 1, timeout: 20 }
        )
      ).rejects.toThrow();
      expect(requestSpy).toHaveBeenCalledTimes(requestSpyCallCount);
      expect(onErrorFn).toHaveBeenCalledTimes(0);

      requestSpy.mockRestore();
    });

    // https://github.com/apollographql/apollo-client/issues/9431
    // https://github.com/apollographql/apollo-client/issues/11750
    it("stops polling when component unmounts in strict mode with cache-and-network fetch policy", async () => {
      const query: TypedDocumentNode<{ hello: string }> = gql`
        query {
          hello
        }
      `;

      const mocks: MockedResponse[] = [
        {
          request: { query },
          result: { data: { hello: "world 1" } },
          delay: 3,
        },
        {
          request: { query },
          result: { data: { hello: "world 2" } },
          delay: 3,
        },
        {
          request: { query },
          result: { data: { hello: "world 3" } },
          delay: 3,
        },
      ];

      const cache = new InMemoryCache();

      const link = new MockLink(mocks);
      const requestSpy = jest.spyOn(link, "request");
      const onErrorFn = jest.fn();
      link.setOnError(onErrorFn);

      const client = new ApolloClient({ link, cache });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, unmount } = await renderHookToSnapshotStream(
        () =>
          useQuery(query, {
            pollInterval: 25,
            fetchPolicy: "cache-and-network",
          }),
        {
          wrapper: ({ children }: any) => (
            <React.StrictMode>
              <ApolloProvider client={client}>{children}</ApolloProvider>
            </React.StrictMode>
          ),
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
        expect(requestSpy).toHaveBeenCalledTimes(1);
      }

      await wait(25);

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });
        expect(requestSpy).toHaveBeenCalledTimes(2);
      }

      unmount();

      await expect(takeSnapshot).not.toRerender({ timeout: 50 });
      // TODO rarely seeing 3 here investigate further
      expect(requestSpy).toHaveBeenCalledTimes(2);
      expect(onErrorFn).toHaveBeenCalledTimes(0);
    });

    it("should start and stop polling in Strict Mode", async () => {
      const query = gql`
        {
          hello
        }
      `;
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
      const requestSpy = jest.spyOn(link, "request");
      const onErrorFn = jest.fn();
      link.setOnError(onErrorFn);
      const wrapper = ({ children }: any) => (
        <React.StrictMode>
          <MockedProvider link={link} cache={cache}>
            {children}
          </MockedProvider>
        </React.StrictMode>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { pollInterval: 20 }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      getCurrentSnapshot().stopPolling();

      await expect(takeSnapshot).not.toRerender({ timeout: 50 });

      getCurrentSnapshot().startPolling(20);

      expect(requestSpy).toHaveBeenCalledTimes(2);
      expect(onErrorFn).toHaveBeenCalledTimes(0);

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 3" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 2" },
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 4" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 3" },
          variables: {},
        });
      }

      expect(requestSpy).toHaveBeenCalledTimes(4);
      expect(onErrorFn).toHaveBeenCalledTimes(0);
      requestSpy.mockRestore();
    });

    // TODO: This test does not really check for an error so we should probably
    // do something different. That said, there are several other tests that
    // call stopPolling on its own so we should either move this up in the test
    // suite, or delete it as its tested from other tests.
    it("should not throw an error if stopPolling is called manually", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: "world" },
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot, unmount } =
        await renderHookToSnapshotStream(() => useQuery(query), {
          wrapper,
        });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      unmount();
      getCurrentSnapshot().stopPolling();
    });

    describe("should prevent fetches when `skipPollAttempt` returns `false`", () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      });

      it("when defined as a global default option", async () => {
        const skipPollAttempt = jest.fn().mockImplementation(() => false);

        const query = gql`
          {
            hello
          }
        `;
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
          }
        );

        const client = new ApolloClient({
          link,
          cache: new InMemoryCache(),
          defaultOptions: {
            watchQuery: {
              skipPollAttempt,
            },
          },
        });

        const wrapper = ({ children }: any) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        );

        const { result } = renderHook(
          () => useQuery(query, { pollInterval: 10 }),
          { wrapper }
        );

        expect(result.current).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });

        await waitFor(
          () => {
            expect(result.current).toEqualQueryResult({
              data: { hello: "world 1" },
              called: true,
              loading: false,
              networkStatus: NetworkStatus.ready,
              previousData: undefined,
              variables: {},
            });
          },
          { interval: 1 }
        );

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });

        skipPollAttempt.mockImplementation(() => true);

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });

        skipPollAttempt.mockImplementation(() => false);

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 3" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 2" },
          variables: {},
        });
      });

      it("when defined for a single query", async () => {
        const skipPollAttempt = jest.fn().mockImplementation(() => false);

        const query = gql`
          {
            hello
          }
        `;
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
          <MockedProvider mocks={mocks} cache={cache}>
            {children}
          </MockedProvider>
        );

        const { result } = renderHook(
          () =>
            useQuery(query, {
              pollInterval: 10,
              skipPollAttempt,
            }),
          { wrapper }
        );

        expect(result.current).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });

        await waitFor(
          () => {
            expect(result.current).toEqualQueryResult({
              data: { hello: "world 1" },
              called: true,
              loading: false,
              networkStatus: NetworkStatus.ready,
              previousData: undefined,
              variables: {},
            });
          },
          { interval: 1 }
        );

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });

        skipPollAttempt.mockImplementation(() => true);

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });

        skipPollAttempt.mockImplementation(() => false);

        await jest.advanceTimersByTimeAsync(12);
        expect(result.current).toEqualQueryResult({
          data: { hello: "world 3" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 2" },
          variables: {},
        });
      });
    });
  });

  describe("Error handling", () => {
    it("should pass along GraphQL errors", async () => {
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
            errors: [new GraphQLError("error")],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }
    });

    it("calls `onError` when a GraphQL error is returned", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError("error")],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        new ApolloError({ graphQLErrors: [{ message: "error" }] })
      );

      await expect(takeSnapshot).not.toRerender();
    });

    it("calls `onError` when a network error has occurred", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          error: new Error("Could not fetch"),
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({
            networkError: new Error("Could not fetch"),
          }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        new ApolloError({ networkError: new Error("Could not fetch") })
      );

      await expect(takeSnapshot).not.toRerender();
    });

    it("removes partial data from result when response has errors", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({
            graphQLErrors: [{ message: 'Could not fetch "hello"' }],
          }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it('does not call `onError` when returning GraphQL errors while using an `errorPolicy` set to "ignore"', async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError("error")],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError, errorPolicy: "ignore" }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await tick();

      expect(onError).not.toHaveBeenCalled();

      await expect(takeSnapshot).not.toRerender();
    });

    it('calls `onError` when a network error has occurred while using an `errorPolicy` set to "ignore"', async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          error: new Error("Could not fetch"),
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError, errorPolicy: "ignore" }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({
            networkError: new Error("Could not fetch"),
          }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        new ApolloError({ networkError: new Error("Could not fetch") })
      );

      await expect(takeSnapshot).not.toRerender();
    });

    it('returns partial data and discards GraphQL errors when using an `errorPolicy` set to "ignore"', async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { errorPolicy: "ignore" }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: null },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it('calls `onCompleted` with partial data but avoids calling `onError` when using an `errorPolicy` set to "ignore"', async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      const onCompleted = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError, onCompleted, errorPolicy: "ignore" }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: null },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith({ hello: null });
      expect(onError).not.toHaveBeenCalled();

      await expect(takeSnapshot).not.toRerender();
    });

    it('calls `onError` when returning GraphQL errors while using an `errorPolicy` set to "all"', async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError("error")],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError, errorPolicy: "all" }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error" }] }),
          // TODO: Why does this only populate when errorPolicy is "all"?
          errors: [{ message: "error" }],
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        new ApolloError({ graphQLErrors: [new GraphQLError("error")] })
      );

      await expect(takeSnapshot).not.toRerender();
    });

    it('returns partial data when returning GraphQL errors while using an `errorPolicy` set to "all"', async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError, errorPolicy: "all" }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: null },
          error: new ApolloError({
            graphQLErrors: [{ message: 'Could not fetch "hello"' }],
          }),
          errors: [{ message: 'Could not fetch "hello"' }],
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it('calls `onError` but not `onCompleted` when returning partial data with GraphQL errors while using an `errorPolicy` set to "all"', async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            data: { hello: null },
            errors: [new GraphQLError('Could not fetch "hello"')],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      const onCompleted = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError, onCompleted, errorPolicy: "all" }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: null },
          error: new ApolloError({
            graphQLErrors: [{ message: 'Could not fetch "hello"' }],
          }),
          errors: [{ message: 'Could not fetch "hello"' }],
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        new ApolloError({
          graphQLErrors: [new GraphQLError('Could not fetch "hello"')],
        })
      );
      expect(onCompleted).not.toHaveBeenCalled();

      await expect(takeSnapshot).not.toRerender();
    });

    it("calls `onError` a single time when refetching returns a successful result", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError("error")],
          },
        },
        {
          request: { query },
          result: {
            data: { hello: "world" },
          },
          delay: 10,
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              onError,
              notifyOnNetworkStatusChange: true,
            }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);

      void getCurrentSnapshot().refetch();

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.refetch,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);

      await expect(takeSnapshot).not.toRerender();
    });

    it("should persist errors on re-render if they are still valid", async () => {
      const query = gql`
        {
          hello
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError("error")],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        () => useQuery(query),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await rerender(undefined);

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    // TODO: Rewrite this test using renderHookToSnapshotStream
    it("should not return partial data from cache on refetch with errorPolicy: none (default) and notifyOnNetworkStatusChange: true", async () => {
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
          id: "Z1fdFgU",
          breed: "affenpinscher",
          __typename: "Dog",
        },
        {
          id: "ZNDtCU",
          breed: "airedale",
          __typename: "Dog",
        },
      ];

      const detailsMock = (breed: string) => ({
        request: { query: GET_DOG_DETAILS, variables: { breed } },
        result: {
          errors: [
            new GraphQLError(`Cannot query field "unexisting" on type "Dog".`),
          ],
        },
      });

      const mocks = [
        {
          request: { query },
          result: { data: { dogs: dogData } },
        },
        // use the same mock for the initial query on select change
        // and subsequent refetch() call
        detailsMock("airedale"),
        detailsMock("airedale"),
      ];
      const Dogs: React.FC<{
        onDogSelected: (event: React.ChangeEvent<HTMLSelectElement>) => void;
      }> = ({ onDogSelected }) => {
        const { loading, error, data } = useQuery<{
          dogs: { id: string; breed: string }[];
        }>(query);

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
            notifyOnNetworkStatusChange: true,
          }
        );
        if (networkStatus === 4) return <p>Refetching!</p>;
        if (loading) return <p>Loading!</p>;
        return (
          <div>
            <div>{data ? "Partial data rendered" : null}</div>

            <div>{error ? `Error!: ${error}` : "Rendering!"}</div>
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
      await screen.findByText("affenpinscher");

      // the user selects a different dog from the dropdown which
      // fires the GET_DOG_DETAILS query, retuning an error
      const user = userEvent.setup();
      await user.selectOptions(
        screen.getByRole("combobox"),
        screen.getByRole("option", { name: "airedale" })
      );

      // With the default errorPolicy of 'none', the error is rendered
      // and partial data is not
      await screen.findByText(
        'Error!: ApolloError: Cannot query field "unexisting" on type "Dog".'
      );
      expect(screen.queryByText(/partial data rendered/i)).toBeNull();

      // When we call refetch...
      await user.click(screen.getByRole("button", { name: /Refetch!/i }));

      // The error is still present, and partial data still not rendered
      await screen.findByText(
        'Error!: ApolloError: Cannot query field "unexisting" on type "Dog".'
      );
      expect(screen.queryByText(/partial data rendered/i)).toBeNull();
    });

    // TODO: Rewrite this test using renderHookToSnapshotStream
    it("should return partial data from cache on refetch", async () => {
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
              id: "ZNDtCU",
              __typename: "Dog",
            },
          },
        },
      });

      const mocks = [
        // use the same mock for the initial query on select change
        // and subsequent refetch() call
        detailsMock("airedale"),
        detailsMock("airedale"),
      ];

      const DogDetails: React.FC<{
        breed?: string;
      }> = ({ breed = "airedale" }) => {
        const { data, refetch, networkStatus } = useQuery(GET_DOG_DETAILS, {
          variables: { breed },
          notifyOnNetworkStatusChange: true,
        });
        if (networkStatus === 1) return <p>Loading!</p>;
        return (
          // Render existing results, but dim the UI until the results
          // have finished loading...
          <div style={{ opacity: networkStatus === 4 ? 0.5 : 1 }}>
            <div>{data ? "Data rendered" : null}</div>
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

      await waitFor(
        () => {
          expect(screen.getByText("Loading!")).toBeTruthy();
        },
        { interval: 1 }
      );

      await waitFor(
        () => {
          expect(screen.getByText("Data rendered")).toBeTruthy();
        },
        { interval: 1 }
      );

      // When we call refetch...
      await user.click(screen.getByRole("button", { name: /Refetch!/i }));

      // Data from the cache remains onscreen while network request
      // is made
      expect(screen.getByText("Data rendered")).toBeTruthy();
    });

    it("should persist errors on re-render with inline onError/onCompleted callbacks", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError("error")],
          },
        },
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        () => useQuery(query, { onError: () => {}, onCompleted: () => {} }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await rerender(undefined);

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onErrorFn).toHaveBeenCalledTimes(0);

      await expect(takeSnapshot).not.toRerender();
    });

    it("should not persist errors when variables change", async () => {
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
            errors: [new GraphQLError("error")],
          },
        },
        {
          request: {
            query,
            variables: { id: 2 },
          },
          result: {
            data: { hello: "world 2" },
          },
        },
        {
          request: {
            query,
            variables: { id: 1 },
          },
          result: {
            data: { hello: "world 1" },
          },
        },
      ];

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ id }) => useQuery(query, { variables: { id } }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
          initialProps: { id: 1 },
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      await rerender({ id: 2 });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: undefined,
          variables: { id: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { id: 2 },
        });
      }

      await rerender({ id: 1 });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: { hello: "world 2" },
          variables: { id: 1 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 2" },
          variables: { id: 1 },
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("should render multiple errors when refetching", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError("error 1")],
          },
        },
        {
          request: { query },
          result: {
            errors: [new GraphQLError("error 2")],
          },
          delay: 10,
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { notifyOnNetworkStatusChange: true }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error 1" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(getCurrentSnapshot().refetch()).rejects.toEqual(
        new ApolloError({ graphQLErrors: [{ message: "error 2" }] })
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.refetch,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({ graphQLErrors: [{ message: "error 2" }] }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("should render the same error on refetch", async () => {
      const query = gql`
        {
          hello
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError("same error")],
          },
        },
        {
          request: { query },
          result: {
            errors: [new GraphQLError("same error")],
          },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { notifyOnNetworkStatusChange: true }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({
            graphQLErrors: [{ message: "same error" }],
          }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(getCurrentSnapshot().refetch()).rejects.toEqual(
        new ApolloError({ graphQLErrors: [{ message: "same error" }] })
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.refetch,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({
            graphQLErrors: [{ message: "same error" }],
          }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("should render data and errors with refetch", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: {
            errors: [new GraphQLError("same error")],
          },
        },
        {
          request: { query },
          result: {
            data: { hello: "world" },
          },
          delay: 10,
        },
        {
          request: { query },
          result: {
            errors: [new GraphQLError("same error")],
          },
          delay: 10,
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { notifyOnNetworkStatusChange: true }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }
      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          error: new ApolloError({
            graphQLErrors: [{ message: "same error" }],
          }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await getCurrentSnapshot().refetch();

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.refetch,
          previousData: undefined,
          variables: {},
        });
      }
      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(getCurrentSnapshot().refetch()).rejects.toEqual(
        new ApolloError({ graphQLErrors: [{ message: "same error" }] })
      );

      {
        const result = await takeSnapshot();
        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.refetch,
          previousData: { hello: "world" },
          variables: {},
        });
      }
      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          // TODO: Is this correct behavior here?
          data: { hello: "world" },
          error: new ApolloError({
            graphQLErrors: [{ message: "same error" }],
          }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: { hello: "world" },
          variables: {},
        });
      }
    });

    it("should call onCompleted when variables change", async () => {
      const query = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ variables }) => useQuery(query, { variables, onCompleted }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
          initialProps: {
            variables: { first: 1 },
          },
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { first: 1 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: data1,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { first: 1 },
        });
      }

      expect(onCompleted).toHaveBeenLastCalledWith(data1);

      await rerender({ variables: { first: 2 } });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: data1,
          variables: { first: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: data2,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: data1,
          variables: { first: 2 },
        });
      }

      expect(onCompleted).toHaveBeenLastCalledWith(data2);

      await rerender({ variables: { first: 1 } });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: data1,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: data2,
          variables: { first: 1 },
        });
      }

      expect(onCompleted).toHaveBeenLastCalledWith(data1);
      expect(onCompleted).toHaveBeenCalledTimes(3);

      await expect(takeSnapshot).not.toRerender();
    });
  });

  describe("Pagination", () => {
    const query = gql`
      query letters($limit: Int) {
        letters(limit: $limit) {
          name
          position
        }
      }
    `;

    const ab = [
      { name: "A", position: 1 },
      { name: "B", position: 2 },
    ];

    const cd = [
      { name: "C", position: 3 },
      { name: "D", position: 4 },
    ];

    // TODO: Include an offset variable so that these tests more closely
    // resemble a real-world paginated API
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

    it("should fetchMore with updateQuery", async () => {
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { variables: { limit: 2 } }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      const fetchMoreResult = await getCurrentSnapshot().fetchMore({
        variables: { limit: 2 },
        updateQuery: (prev, { fetchMoreResult }) => ({
          letters: prev.letters.concat(fetchMoreResult.letters),
        }),
      });

      expect(fetchMoreResult).toEqualApolloQueryResult({
        data: { letters: cd },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab.concat(cd) },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { letters: ab },
          variables: { limit: 2 },
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("should fetchMore with updateQuery and notifyOnNetworkStatusChange", async () => {
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              variables: { limit: 2 },
              notifyOnNetworkStatusChange: true,
            }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      const fetchMoreResult = await getCurrentSnapshot().fetchMore({
        variables: { limit: 2 },
        updateQuery: (prev, { fetchMoreResult }) => ({
          letters: prev.letters.concat(fetchMoreResult.letters),
        }),
      });

      expect(fetchMoreResult).toEqualApolloQueryResult({
        data: { letters: cd },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.fetchMore,
          previousData: { letters: ab },
          variables: { limit: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab.concat(cd) },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { letters: ab },
          variables: { limit: 2 },
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("fetchMore with concatPagination", async () => {
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
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { variables: { limit: 2 } }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      const fetchMoreResult = await getCurrentSnapshot().fetchMore({
        variables: { limit: 2 },
      });

      expect(fetchMoreResult).toEqualApolloQueryResult({
        data: { letters: cd },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab.concat(cd) },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { letters: ab },
          variables: { limit: 2 },
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("fetchMore with concatPagination and notifyOnNetworkStatusChange", async () => {
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
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              variables: { limit: 2 },
              notifyOnNetworkStatusChange: true,
            }),
          { wrapper }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      const fetchMoreResult = await getCurrentSnapshot().fetchMore({
        variables: { limit: 2 },
      });

      expect(fetchMoreResult).toEqualApolloQueryResult({
        data: { letters: cd },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.fetchMore,
          previousData: { letters: ab },
          variables: { limit: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { letters: ab.concat(cd) },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { letters: ab },
          variables: { limit: 2 },
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    // https://github.com/apollographql/apollo-client/issues/11965
    it("should only execute single network request when calling fetchMore with no-cache fetch policy", async () => {
      let fetches: Array<{ variables: Record<string, unknown> }> = [];
      const { query, data } = setupPaginatedCase();

      const link = new ApolloLink((operation) => {
        fetches.push({ variables: operation.variables });

        const { offset = 0, limit = 2 } = operation.variables;
        const letters = data.slice(offset, offset + limit);

        return new Observable((observer) => {
          setTimeout(() => {
            observer.next({ data: { letters } });
            observer.complete();
          }, 10);
        });
      });

      const client = new ApolloClient({ cache: new InMemoryCache(), link });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              fetchPolicy: "no-cache",
              variables: { limit: 2 },
            }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      // loading
      await takeSnapshot();
      // finished loading
      await takeSnapshot();

      expect(fetches).toStrictEqual([{ variables: { limit: 2 } }]);

      const { fetchMore } = getCurrentSnapshot();

      await fetchMore({
        variables: { offset: 2 },
        updateQuery: (_, { fetchMoreResult }) => fetchMoreResult,
      });

      expect(fetches).toStrictEqual([
        { variables: { limit: 2 } },
        { variables: { limit: 2, offset: 2 } },
      ]);
    });

    it("uses updateQuery to update the result of the query with no-cache queries", async () => {
      const { query, link } = setupPaginatedCase();

      const client = new ApolloClient({ cache: new InMemoryCache(), link });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              notifyOnNetworkStatusChange: true,
              fetchPolicy: "no-cache",
              variables: { limit: 2 },
            }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            letters: [
              { __typename: "Letter", letter: "A", position: 1 },
              { __typename: "Letter", letter: "B", position: 2 },
            ],
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { limit: 2 },
        });
      }

      const { fetchMore } = getCurrentSnapshot();

      let fetchMorePromise = fetchMore({
        variables: { offset: 2 },
        updateQuery: (prev, { fetchMoreResult }) => ({
          letters: prev.letters.concat(fetchMoreResult.letters),
        }),
      });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            letters: [
              { __typename: "Letter", letter: "A", position: 1 },
              { __typename: "Letter", letter: "B", position: 2 },
            ],
          },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.fetchMore,
          previousData: {
            letters: [
              { __typename: "Letter", letter: "A", position: 1 },
              { __typename: "Letter", letter: "B", position: 2 },
            ],
          },
          variables: { limit: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            letters: [
              { __typename: "Letter", letter: "A", position: 1 },
              { __typename: "Letter", letter: "B", position: 2 },
              { __typename: "Letter", letter: "C", position: 3 },
              { __typename: "Letter", letter: "D", position: 4 },
            ],
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: {
            letters: [
              { __typename: "Letter", letter: "A", position: 1 },
              { __typename: "Letter", letter: "B", position: 2 },
            ],
          },
          variables: { limit: 2 },
        });

        // Ensure we store the merged result as the last result
        expect(result.observable.getCurrentResult(false).data).toEqual({
          letters: [
            { __typename: "Letter", letter: "A", position: 1 },
            { __typename: "Letter", letter: "B", position: 2 },
            { __typename: "Letter", letter: "C", position: 3 },
            { __typename: "Letter", letter: "D", position: 4 },
          ],
        });
      }

      await expect(fetchMorePromise).resolves.toEqualApolloQueryResult({
        data: {
          letters: [
            { __typename: "Letter", letter: "C", position: 3 },
            { __typename: "Letter", letter: "D", position: 4 },
          ],
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      await expect(takeSnapshot).not.toRerender();

      fetchMorePromise = fetchMore({
        variables: { offset: 4 },
        updateQuery: (_, { fetchMoreResult }) => fetchMoreResult,
      });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            letters: [
              { __typename: "Letter", letter: "A", position: 1 },
              { __typename: "Letter", letter: "B", position: 2 },
              { __typename: "Letter", letter: "C", position: 3 },
              { __typename: "Letter", letter: "D", position: 4 },
            ],
          },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.fetchMore,
          previousData: {
            letters: [
              { __typename: "Letter", letter: "A", position: 1 },
              { __typename: "Letter", letter: "B", position: 2 },
              { __typename: "Letter", letter: "C", position: 3 },
              { __typename: "Letter", letter: "D", position: 4 },
            ],
          },
          variables: { limit: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            letters: [
              { __typename: "Letter", letter: "E", position: 5 },
              { __typename: "Letter", letter: "F", position: 6 },
            ],
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: {
            letters: [
              { __typename: "Letter", letter: "A", position: 1 },
              { __typename: "Letter", letter: "B", position: 2 },
              { __typename: "Letter", letter: "C", position: 3 },
              { __typename: "Letter", letter: "D", position: 4 },
            ],
          },
          variables: { limit: 2 },
        });

        expect(result.observable.getCurrentResult(false).data).toEqual({
          letters: [
            { __typename: "Letter", letter: "E", position: 5 },
            { __typename: "Letter", letter: "F", position: 6 },
          ],
        });
      }

      await expect(fetchMorePromise).resolves.toEqualApolloQueryResult({
        data: {
          letters: [
            { __typename: "Letter", letter: "E", position: 5 },
            { __typename: "Letter", letter: "F", position: 6 },
          ],
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      await expect(takeSnapshot).not.toRerender();
    });

    it("throws when using fetchMore without updateQuery for no-cache queries", async () => {
      const { query, link } = setupPaginatedCase();

      const client = new ApolloClient({ cache: new InMemoryCache(), link });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              fetchPolicy: "no-cache",
              variables: { limit: 2 },
            }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      // loading
      await takeSnapshot();
      // finished loading
      await takeSnapshot();

      const { fetchMore } = getCurrentSnapshot();

      expect(() => fetchMore({ variables: { offset: 2 } })).toThrow(
        new InvariantError(
          "You must provide an `updateQuery` function when using `fetchMore` with a `no-cache` fetch policy."
        )
      );
    });

    it("does not write to cache when using fetchMore with no-cache queries", async () => {
      const { query, data } = setupPaginatedCase();

      const link = new ApolloLink((operation) => {
        const { offset = 0, limit = 2 } = operation.variables;
        const letters = data.slice(offset, offset + limit);

        return new Observable((observer) => {
          setTimeout(() => {
            observer.next({ data: { letters } });
            observer.complete();
          }, 10);
        });
      });

      const client = new ApolloClient({ cache: new InMemoryCache(), link });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              fetchPolicy: "no-cache",
              variables: { limit: 2 },
            }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      // initial loading
      await takeSnapshot();

      // Initial result
      await takeSnapshot();

      const { fetchMore } = getCurrentSnapshot();
      await fetchMore({
        variables: { offset: 2 },
        updateQuery: (_, { fetchMoreResult }) => fetchMoreResult,
      });

      expect(client.extract()).toStrictEqual({});
    });

    it("regression test for issue #8600", async () => {
      const cache = new InMemoryCache({
        typePolicies: {
          Country: {
            fields: {
              cities: {
                keyArgs: ["size"],
                merge(existing, incoming, { args }) {
                  if (!args) return incoming;

                  const items = existing ? existing.slice(0) : [];

                  const offset = args.offset ?? 0;
                  for (let i = 0; i < incoming.length; ++i) {
                    items[offset + i] = incoming[i];
                  }

                  return items;
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
          __typename: "Country",
          id: 123,
          biggestCity: {
            __typename: "City",
            id: 234,
            info: {
              __typename: "CityInfo",
              airQuality: 0,
            },
          },
          smallCities: [{ __typename: "City", id: 345 }],
        },
      ];

      const wrapper = ({ children }: any) => (
        <MockedProvider
          mocks={[
            {
              request: { query: GET_COUNTRIES },
              result: { data: { countries } },
            },
          ]}
          cache={cache}
        >
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(GET_COUNTRIES),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { countries },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });
  });

  // https://github.com/apollographql/apollo-client/issues/11400
  it("does not return partial data unexpectedly when one query errors, then another succeeds with overlapping data", async () => {
    interface Query1 {
      person: {
        __typename: "Person";
        id: number;
        firstName: string;
        alwaysFails: boolean;
      } | null;
    }

    interface Query2 {
      person: { __typename: "Person"; id: number; lastName: string } | null;
    }

    interface Variables {
      id: number;
    }

    const user = userEvent.setup();

    const query1: TypedDocumentNode<Query1, Variables> = gql`
      query PersonQuery1($id: ID!) {
        person(id: $id) {
          id
          firstName
          alwaysFails
        }
      }
    `;

    const query2: TypedDocumentNode<Query2, Variables> = gql`
      query PersonQuery2($id: ID!) {
        person(id: $id) {
          id
          lastName
        }
      }
    `;

    using _disabledAct = disableActEnvironment();
    const renderStream = createRenderStream({
      initialSnapshot: {
        useQueryResult: null as QueryResult<Query1, Variables> | null,
        useLazyQueryResult: null as QueryResult<Query2, Variables> | null,
      },
    });

    const client = new ApolloClient({
      link: new MockLink([
        {
          request: { query: query1, variables: { id: 1 } },
          result: {
            data: { person: null },
            errors: [new GraphQLError("Intentional error")],
          },
          maxUsageCount: Number.POSITIVE_INFINITY,
          delay: 20,
        },
        {
          request: { query: query2, variables: { id: 1 } },
          result: {
            data: { person: { __typename: "Person", id: 1, lastName: "Doe" } },
          },
          delay: 20,
        },
      ]),
      cache: new InMemoryCache(),
    });

    function App() {
      const useQueryResult = useQuery(query1, {
        variables: { id: 1 },
        // This is necessary to reproduce the behavior
        notifyOnNetworkStatusChange: true,
      });

      const [execute, useLazyQueryResult] = useLazyQuery(query2, {
        variables: { id: 1 },
      });

      renderStream.replaceSnapshot({ useQueryResult, useLazyQueryResult });

      return (
        <>
          <button onClick={() => execute()}>Run 2nd query</button>
          <button
            onClick={() => {
              // Intentionally use reobserve here as opposed to refetch to
              // ensure we check against reported cache results with cache-first
              // and notifyOnNetworkStatusChange
              void useQueryResult.observable.reobserve();
            }}
          >
            Reload 1st query
          </button>
        </>
      );
    }

    await renderStream.render(<App />, {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    await user.click(screen.getByText("Run 2nd query"));

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      // ensure we aren't setting a value on the observable query that contains
      // the partial result
      expect(
        snapshot.useQueryResult?.observable.getCurrentResult(false)!
      ).toEqualApolloQueryResult({
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        errors: [new GraphQLError("Intentional error")],
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
        // TODO: Fix ApolloQueryResult type to allow `data` to be an optional property.
        // This fails without the type case for now even though the runtime
        // code doesn't include a `data` property.
      } as unknown as ApolloQueryResult<Query1>);

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: { person: { __typename: "Person", id: 1, lastName: "Doe" } },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    await user.click(screen.getByText("Reload 1st query"));

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: { person: { __typename: "Person", id: 1, lastName: "Doe" } },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      // ensure we aren't setting a value on the observable query that contains
      // the partial result
      expect(
        snapshot.useQueryResult?.observable.getCurrentResult(false)!
      ).toEqualApolloQueryResult({
        // TODO: Fix TypeScript types to allow for `data` to be `undefined`
        data: undefined as unknown as Query1,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        errors: [new GraphQLError("Intentional error")],
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: { person: { __typename: "Person", id: 1, lastName: "Doe" } },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    await expect(renderStream).not.toRerender();
  });

  it("rerenders errored query for full cache write", async () => {
    interface Query1 {
      person: {
        __typename: "Person";
        id: number;
        firstName: string;
      } | null;
    }

    interface Query2 {
      person: {
        __typename: "Person";
        id: number;
        firstName: string;
        lastName: string;
      } | null;
    }

    interface Variables {
      id: number;
    }

    const user = userEvent.setup();

    const query1: TypedDocumentNode<Query1, Variables> = gql`
      query PersonQuery1($id: ID!) {
        person(id: $id) {
          id
          firstName
        }
      }
    `;

    const query2: TypedDocumentNode<Query2, Variables> = gql`
      query PersonQuery2($id: ID!) {
        person(id: $id) {
          id
          firstName
          lastName
        }
      }
    `;

    using _disabledAct = disableActEnvironment();
    const renderStream = createRenderStream({
      initialSnapshot: {
        useQueryResult: null as QueryResult<Query1, Variables> | null,
        useLazyQueryResult: null as QueryResult<Query2, Variables> | null,
      },
    });

    const client = new ApolloClient({
      link: new MockLink([
        {
          request: { query: query1, variables: { id: 1 } },
          result: {
            data: { person: null },
            errors: [new GraphQLError("Intentional error")],
          },
          delay: 20,
        },
        {
          request: { query: query2, variables: { id: 1 } },
          result: {
            data: {
              person: {
                __typename: "Person",
                id: 1,
                firstName: "John",
                lastName: "Doe",
              },
            },
          },
          delay: 20,
        },
      ]),
      cache: new InMemoryCache(),
    });

    function App() {
      const useQueryResult = useQuery(query1, {
        variables: { id: 1 },
        // This is necessary to reproduce the behavior
        notifyOnNetworkStatusChange: true,
      });

      const [execute, useLazyQueryResult] = useLazyQuery(query2, {
        variables: { id: 1 },
      });

      renderStream.replaceSnapshot({ useQueryResult, useLazyQueryResult });

      return <button onClick={() => execute()}>Run 2nd query</button>;
    }

    await renderStream.render(<App />, {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    await user.click(screen.getByText("Run 2nd query"));

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      // We don't see the update from the cache for one more render cycle, hence
      // why this is still showing the error result even though the result from
      // the other query has finished and re-rendered.
      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: {
          person: {
            __typename: "Person",
            id: 1,
            firstName: "John",
            lastName: "Doe",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: {
          person: {
            __typename: "Person",
            id: 1,
            firstName: "John",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: {
          person: {
            __typename: "Person",
            id: 1,
            firstName: "John",
            lastName: "Doe",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    await expect(renderStream).not.toRerender();
  });

  it("does not rerender or refetch queries with errors for partial cache writes with returnPartialData: true", async () => {
    interface Query1 {
      person: {
        __typename: "Person";
        id: number;
        firstName: string;
        alwaysFails: boolean;
      } | null;
    }

    interface Query2 {
      person: {
        __typename: "Person";
        id: number;
        lastName: string;
      } | null;
    }

    interface Variables {
      id: number;
    }

    const user = userEvent.setup();

    const query1: TypedDocumentNode<Query1, Variables> = gql`
      query PersonQuery1($id: ID!) {
        person(id: $id) {
          id
          firstName
          alwaysFails
        }
      }
    `;

    const query2: TypedDocumentNode<Query2, Variables> = gql`
      query PersonQuery2($id: ID!) {
        person(id: $id) {
          id
          lastName
        }
      }
    `;

    using _disabledAct = disableActEnvironment();
    const renderStream = createRenderStream({
      initialSnapshot: {
        useQueryResult: null as QueryResult<Query1, Variables> | null,
        useLazyQueryResult: null as QueryResult<Query2, Variables> | null,
      },
    });

    const client = new ApolloClient({
      link: new MockLink([
        {
          request: { query: query1, variables: { id: 1 } },
          result: {
            data: { person: null },
            errors: [new GraphQLError("Intentional error")],
          },
          delay: 20,
          maxUsageCount: Number.POSITIVE_INFINITY,
        },
        {
          request: { query: query2, variables: { id: 1 } },
          result: {
            data: {
              person: {
                __typename: "Person",
                id: 1,
                lastName: "Doe",
              },
            },
          },
          delay: 20,
        },
      ]),
      cache: new InMemoryCache(),
    });

    function App() {
      const useQueryResult = useQuery(query1, {
        variables: { id: 1 },
        notifyOnNetworkStatusChange: true,
        returnPartialData: true,
      });

      const [execute, useLazyQueryResult] = useLazyQuery(query2, {
        variables: { id: 1 },
      });

      renderStream.replaceSnapshot({ useQueryResult, useLazyQueryResult });

      return <button onClick={() => execute()}>Run 2nd query</button>;
    }

    await renderStream.render(<App />, {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    await user.click(screen.getByText("Run 2nd query"));

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Intentional error")],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(snapshot.useLazyQueryResult!).toEqualQueryResult({
        data: {
          person: {
            __typename: "Person",
            id: 1,
            lastName: "Doe",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    await expect(renderStream).not.toRerender();
  });

  it("delivers the full network response when a merge function returns an incomplete result", async () => {
    const query = gql`
      query {
        author {
          id
          name
          post {
            id
            title
          }
        }
      }
    `;

    const client = new ApolloClient({
      link: new MockLink([
        {
          request: { query },
          result: {
            data: {
              author: {
                __typename: "Author",
                id: 1,
                name: "Author Lee",
                post: {
                  __typename: "Post",
                  id: 1,
                  title: "Title",
                },
              },
            },
          },
          delay: 20,
        },
      ]),
      cache: new InMemoryCache({
        typePolicies: {
          Author: {
            fields: {
              post: {
                merge: () => {
                  return {};
                },
              },
            },
          },
        },
      }),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    {
      const result = await takeSnapshot();

      expect(result).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const result = await takeSnapshot();

      expect(result).toEqualQueryResult({
        data: {
          author: {
            __typename: "Author",
            id: 1,
            name: "Author Lee",
            post: {
              __typename: "Post",
              id: 1,
              title: "Title",
            },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it("triggers a network request and rerenders with the new result when a mutation causes a partial cache update due to an incomplete merge function result", async () => {
    const query = gql`
      query {
        author {
          id
          name
          post {
            id
            title
          }
        }
      }
    `;
    const mutation = gql`
      mutation {
        updateAuthor {
          author {
            id
            name
            post {
              id
              title
            }
          }
        }
      }
    `;

    const user = userEvent.setup();

    using _disabledAct = disableActEnvironment();
    const renderStream = createRenderStream({
      initialSnapshot: {
        useQueryResult: null as QueryResult | null,
      },
    });

    const client = new ApolloClient({
      link: new MockLink([
        {
          request: { query },
          result: {
            data: {
              author: {
                __typename: "Author",
                id: 1,
                name: "Author Lee",
                post: {
                  __typename: "Post",
                  id: 1,
                  title: "Title",
                },
              },
            },
          },
          delay: 20,
        },
        {
          request: { query },
          result: {
            data: {
              author: {
                __typename: "Author",
                id: 1,
                name: "Author Lee (refetch)",
                post: {
                  __typename: "Post",
                  id: 1,
                  title: "Title",
                },
              },
            },
          },
          delay: 20,
        },
        {
          request: { query: mutation },
          result: {
            data: {
              updateAuthor: {
                author: {
                  __typename: "Author",
                  id: 1,
                  name: "Author Lee (mutation)",
                  post: {
                    __typename: "Post",
                    id: 1,
                    title: "Title",
                  },
                },
              },
            },
          },
          delay: 20,
        },
      ]),
      cache: new InMemoryCache({
        typePolicies: {
          Author: {
            fields: {
              post: {
                // this is necessary to reproduce the issue
                merge: () => {
                  return {};
                },
              },
            },
          },
        },
      }),
    });

    function App() {
      const useQueryResult = useQuery(query);
      const [mutate] = useMutation(mutation);

      renderStream.replaceSnapshot({ useQueryResult });

      return <button onClick={() => mutate()}>Run mutation</button>;
    }

    await renderStream.render(<App />, {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: {
          author: {
            __typename: "Author",
            id: 1,
            name: "Author Lee",
            post: {
              __typename: "Post",
              id: 1,
              title: "Title",
            },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await user.click(screen.getByText("Run mutation"));
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: {
          author: {
            __typename: "Author",
            id: 1,
            name: "Author Lee",
            post: {
              __typename: "Post",
              id: 1,
              title: "Title",
            },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.useQueryResult!).toEqualQueryResult({
        data: {
          author: {
            __typename: "Author",
            id: 1,
            // Because of the merge function returning an incomplete result, we
            // don't expect to see the value returned from the mutation. The
            // partial result from the mutation causes a network fetch which
            // renders the refetched result.
            name: "Author Lee (refetch)",
            post: {
              __typename: "Post",
              id: 1,
              title: "Title",
            },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          author: {
            __typename: "Author",
            id: 1,
            name: "Author Lee",
            post: {
              __typename: "Post",
              id: 1,
              title: "Title",
            },
          },
        },
        variables: {},
      });
    }

    await expect(renderStream).not.toRerender();
  });

  describe("Refetching", () => {
    it("refetching with different variables", async () => {
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
          delay: 10,
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              variables: { id: 1 },
              notifyOnNetworkStatusChange: true,
            }),
          { wrapper }
        );
      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { id: 1 },
        });
      }
      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      await getCurrentSnapshot().refetch({ id: 2 });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: { hello: "world 1" },
          variables: { id: 2 },
        });
      }
      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: { id: 2 },
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("refetching after an error", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world 1" } },
        },
        {
          request: { query },
          error: new Error("This is an error!"),
          delay: 10,
        },
        {
          request: { query },
          result: { data: { hello: "world 2" } },
          delay: 10,
        },
      ];

      const cache = new InMemoryCache();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useQuery(query, {
              notifyOnNetworkStatusChange: true,
            }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks} cache={cache}>
                {children}
              </MockedProvider>
            ),
          }
        );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }
      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(getCurrentSnapshot().refetch()).rejects.toEqual(
        new ApolloError({ networkError: new Error("This is an error!") })
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.refetch,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          error: new ApolloError({
            networkError: new Error("This is an error!"),
          }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      await expect(
        getCurrentSnapshot().refetch()
      ).resolves.toEqualApolloQueryResult({
        data: { hello: "world 2" },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.refetch,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }
      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    describe("refetchWritePolicy", () => {
      const query = gql`
        query GetPrimes($min: number, $max: number) {
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
            },
          },
        },
        {
          request: {
            query,
            variables: { min: 12, max: 30 },
          },
          result: {
            data: {
              primes: [13, 17, 19, 23, 29],
            },
          },
          delay: 25,
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
          <MockedProvider mocks={mocks} cache={cache}>
            {children}
          </MockedProvider>
        );

        using _disabledAct = disableActEnvironment();
        const { takeSnapshot, getCurrentSnapshot } =
          await renderHookToSnapshotStream(
            () =>
              useQuery(query, {
                variables: { min: 0, max: 12 },
                notifyOnNetworkStatusChange: true,
                // This is the key line in this test.
                refetchWritePolicy: "overwrite",
              }),
            { wrapper }
          );

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: undefined,
            called: true,
            loading: true,
            networkStatus: NetworkStatus.loading,
            previousData: undefined,
            variables: { min: 0, max: 12 },
          });
        }

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: { primes: [2, 3, 5, 7, 11] },
            called: true,
            loading: false,
            networkStatus: NetworkStatus.ready,
            previousData: undefined,
            variables: { min: 0, max: 12 },
          });
        }

        expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

        await expect(
          getCurrentSnapshot().refetch({ min: 12, max: 30 })
        ).resolves.toEqualApolloQueryResult({
          data: { primes: [13, 17, 19, 23, 29] },
          loading: false,
          networkStatus: NetworkStatus.ready,
        });

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            // We get the stale data because we configured keyArgs: false.
            data: { primes: [2, 3, 5, 7, 11] },
            called: true,
            loading: true,
            // This networkStatus is setVariables instead of refetch because we
            // called refetch with new variables.
            networkStatus: NetworkStatus.setVariables,
            previousData: { primes: [2, 3, 5, 7, 11] },
            variables: { min: 12, max: 30 },
          });
        }

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: { primes: [13, 17, 19, 23, 29] },
            called: true,
            loading: false,
            networkStatus: NetworkStatus.ready,
            previousData: { primes: [2, 3, 5, 7, 11] },
            variables: { min: 12, max: 30 },
          });
        }

        expect(mergeParams).toEqual([
          [undefined, [2, 3, 5, 7, 11]],
          // Without refetchWritePolicy: "overwrite", this array will be
          // all 10 primes (2 through 29) together.
          [undefined, [13, 17, 19, 23, 29]],
        ]);
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
          <MockedProvider mocks={mocks} cache={cache}>
            {children}
          </MockedProvider>
        );

        using _disabledAct = disableActEnvironment();
        const { takeSnapshot, getCurrentSnapshot } =
          await renderHookToSnapshotStream(
            () =>
              useQuery(query, {
                variables: { min: 0, max: 12 },
                notifyOnNetworkStatusChange: true,
                // This is the key line in this test.
                refetchWritePolicy: "merge",
              }),
            { wrapper }
          );

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: undefined,
            called: true,
            loading: true,
            networkStatus: NetworkStatus.loading,
            previousData: undefined,
            variables: { min: 0, max: 12 },
          });
        }

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: { primes: [2, 3, 5, 7, 11] },
            called: true,
            loading: false,
            networkStatus: NetworkStatus.ready,
            previousData: undefined,
            variables: { min: 0, max: 12 },
          });
        }

        expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

        await expect(
          getCurrentSnapshot().refetch({ min: 12, max: 30 })
        ).resolves.toEqualApolloQueryResult({
          data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
          loading: false,
          networkStatus: NetworkStatus.ready,
        });

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            // We get the stale data because we configured keyArgs: false.
            data: { primes: [2, 3, 5, 7, 11] },
            called: true,
            loading: true,
            // This networkStatus is setVariables instead of refetch because we
            // called refetch with new variables.
            networkStatus: NetworkStatus.setVariables,
            previousData: { primes: [2, 3, 5, 7, 11] },
            variables: { min: 12, max: 30 },
          });
        }

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
            called: true,
            loading: false,
            networkStatus: NetworkStatus.ready,
            previousData: { primes: [2, 3, 5, 7, 11] },
            variables: { min: 12, max: 30 },
          });
        }

        expect(mergeParams).toEqual([
          [undefined, [2, 3, 5, 7, 11]],
          // This indicates concatenation happened.
          [
            [2, 3, 5, 7, 11],
            [13, 17, 19, 23, 29],
          ],
        ]);
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
          <MockedProvider mocks={mocks} cache={cache}>
            {children}
          </MockedProvider>
        );
        using _disabledAct = disableActEnvironment();
        const { takeSnapshot, getCurrentSnapshot } =
          await renderHookToSnapshotStream(
            () =>
              useQuery(query, {
                variables: { min: 0, max: 12 },
                notifyOnNetworkStatusChange: true,
                // Intentionally not passing refetchWritePolicy.
              }),
            { wrapper }
          );

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: undefined,
            called: true,
            loading: true,
            networkStatus: NetworkStatus.loading,
            previousData: undefined,
            variables: { min: 0, max: 12 },
          });
        }
        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: { primes: [2, 3, 5, 7, 11] },
            called: true,
            loading: false,
            networkStatus: NetworkStatus.ready,
            previousData: undefined,
            variables: { min: 0, max: 12 },
          });
          expect(mergeParams.shift()).toEqual([void 0, [2, 3, 5, 7, 11]]);
        }

        await expect(
          getCurrentSnapshot().refetch({ min: 12, max: 30 })
        ).resolves.toEqualApolloQueryResult({
          data: { primes: [13, 17, 19, 23, 29] },
          loading: false,
          networkStatus: NetworkStatus.ready,
        });

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: {
              // We get the stale data because we configured keyArgs: false.
              primes: [2, 3, 5, 7, 11],
            },
            called: true,
            loading: true,
            // This networkStatus is setVariables instead of refetch because we
            // called refetch with new variables.
            networkStatus: NetworkStatus.setVariables,
            previousData: { primes: [2, 3, 5, 7, 11] },
            variables: { min: 12, max: 30 },
          });
        }

        {
          const result = await takeSnapshot();

          expect(result).toEqualQueryResult({
            data: { primes: [13, 17, 19, 23, 29] },
            called: true,
            loading: false,
            networkStatus: NetworkStatus.ready,
            previousData: { primes: [2, 3, 5, 7, 11] },
            variables: { min: 12, max: 30 },
          });
          expect(mergeParams.shift()).toEqual(
            // Without refetchWritePolicy: "overwrite", this array will be
            // all 10 primes (2 through 29) together.
            [undefined, [13, 17, 19, 23, 29]]
          );
        }
      });
    });

    it("keeps cache consistency when a call to refetchQueries is interrupted with another query caused by changing variables and the second query returns before the first one", async () => {
      const CAR_QUERY_BY_ID = gql`
        query Car($id: Int) {
          car(id: $id) {
            make
            model
          }
        }
      `;

      const mocks = {
        1: [
          {
            car: {
              make: "Audi",
              model: "A4",
              __typename: "Car",
            },
          },
          {
            car: {
              make: "Audi",
              model: "A3", // Changed
              __typename: "Car",
            },
          },
        ],
        2: [
          {
            car: {
              make: "Audi",
              model: "RS8",
              __typename: "Car",
            },
          },
        ],
      };

      const link = new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            if (operation.variables.id === 1) {
              // Queries for this ID return after a delay
              setTimeout(() => {
                const data = mocks[1].splice(0, 1).pop();
                observer.next({ data });
                observer.complete();
              }, 100);
            } else if (operation.variables.id === 2) {
              // Queries for this ID return immediately
              const data = mocks[2].splice(0, 1).pop();
              observer.next({ data });
              observer.complete();
            } else {
              observer.error(new Error("Unexpected query"));
            }
          })
      );
      const client = new ApolloClient({ cache: new InMemoryCache(), link });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ id }) =>
          useQuery(CAR_QUERY_BY_ID, {
            variables: { id },
            notifyOnNetworkStatusChange: true,
            fetchPolicy: "network-only",
          }),
        {
          initialProps: { id: 1 },
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            car: {
              __typename: "Car",
              make: "Audi",
              model: "A4",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { id: 1 },
        });
      }

      void client.reFetchObservableQueries();

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            car: {
              __typename: "Car",
              make: "Audi",
              model: "A4",
            },
          },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.refetch,
          previousData: {
            car: {
              __typename: "Car",
              make: "Audi",
              model: "A4",
            },
          },
          variables: { id: 1 },
        });
      }

      // Rerender with new variables before the refetch request completes
      await rerender({ id: 2 });

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.setVariables,
          previousData: {
            car: {
              __typename: "Car",
              make: "Audi",
              model: "A4",
            },
          },
          variables: { id: 2 },
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: {
            car: {
              __typename: "Car",
              make: "Audi",
              model: "RS8",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: {
            car: {
              __typename: "Car",
              make: "Audi",
              model: "A4",
            },
          },
          variables: { id: 2 },
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });
  });

  describe("Callbacks", () => {
    it("onCompleted is called once with cached data", async () => {
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

      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={[]} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () =>
          useQuery(query, {
            fetchPolicy: "cache-only",
            onCompleted,
          }),
        { wrapper }
      );

      const result = await takeSnapshot();

      expect(result).toEqualQueryResult({
        data: { hello: "world" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith({ hello: "world" });

      await expect(takeSnapshot).not.toRerender();
    });

    it("onCompleted is called once despite state changes", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        () => useQuery(query, { onCompleted }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith({ hello: "world" });

      await rerender(undefined);

      {
        const result = await takeSnapshot();

        expect(result).toEqualQueryResult({
          data: { hello: "world" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith({ hello: "world" });

      await expect(takeSnapshot).not.toRerender();
    });

    it("should not call onCompleted if skip is true", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () =>
          useQuery(query, {
            skip: true,
            onCompleted,
          }),
        { wrapper }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      expect(onCompleted).toHaveBeenCalledTimes(0);
      await expect(takeSnapshot).not.toRerender();
      expect(onCompleted).toHaveBeenCalledTimes(0);
    });

    it("should not make extra network requests when `onCompleted` is defined with a `network-only` fetch policy", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => {
          return useQuery(query, {
            fetchPolicy: "network-only",
            onCompleted,
          });
        },
        { wrapper }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    it("onCompleted should not fire for polling queries without notifyOnNetworkStatusChange: true", async () => {
      const query = gql`
        {
          hello
        }
      `;
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
      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () =>
          useQuery(query, {
            onCompleted,
            pollInterval: 10,
          }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world 1" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      expect(onCompleted).toHaveBeenCalledTimes(1);

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world 2" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "world 1" },
        variables: {},
      });

      expect(onCompleted).toHaveBeenCalledTimes(1);

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world 3" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "world 2" },
        variables: {},
      });

      expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    it("onCompleted should fire when polling with notifyOnNetworkStatusChange: true", async () => {
      jest.useFakeTimers();
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world 1" } },
          delay: 20,
        },
        {
          request: { query },
          result: { data: { hello: "world 2" } },
          delay: 20,
        },
        {
          request: { query },
          result: { data: { hello: "world 3" } },
          delay: 20,
        },
      ];

      const cache = new InMemoryCache();
      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () =>
          useQuery(query, {
            onCompleted,
            notifyOnNetworkStatusChange: true,
            pollInterval: 200,
          }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
          ),
        }
      );

      {
        const promise = takeSnapshot();
        await jest.advanceTimersByTimeAsync(0);

        await expect(promise).resolves.toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onCompleted).toHaveBeenCalledTimes(0);
      jest.advanceTimersByTime(20);

      {
        const promise = takeSnapshot();
        await jest.advanceTimersByTimeAsync(0);

        await expect(promise).resolves.toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      expect(onCompleted).toHaveBeenCalledTimes(1);
      // Polling is started with the first request, so we only need to advance
      // the timer by 180 (200 poll time - 20 result delay)
      jest.advanceTimersByTime(180);

      {
        const promise = takeSnapshot();
        await jest.advanceTimersByTimeAsync(0);

        await expect(promise).resolves.toEqualQueryResult({
          data: { hello: "world 1" },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.poll,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      expect(onCompleted).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(20);

      {
        const promise = takeSnapshot();
        await jest.advanceTimersByTimeAsync(0);

        await expect(promise).resolves.toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 1" },
          variables: {},
        });
      }

      expect(onCompleted).toHaveBeenCalledTimes(2);
      jest.advanceTimersByTime(200);

      {
        const promise = takeSnapshot();
        await jest.advanceTimersByTimeAsync(0);

        await expect(promise).resolves.toEqualQueryResult({
          data: { hello: "world 2" },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.poll,
          previousData: { hello: "world 2" },
          variables: {},
        });
      }

      expect(onCompleted).toHaveBeenCalledTimes(2);
      jest.advanceTimersByTime(20);

      {
        const promise = takeSnapshot();
        await jest.advanceTimersByTimeAsync(0);

        await expect(promise).resolves.toEqualQueryResult({
          data: { hello: "world 3" },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { hello: "world 2" },
          variables: {},
        });
      }

      expect(onCompleted).toHaveBeenCalledTimes(3);

      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    // This test was added for issue https://github.com/apollographql/apollo-client/issues/9794
    it("onCompleted can set state without causing react errors", async () => {
      using consoleSpy = spyOnConsole("error");
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
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });

    it("onCompleted should not execute on cache writes after initial query execution", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "foo" } },
        },
        {
          request: { query },
          result: { data: { hello: "bar" } },
        },
      ];
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });
      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { onCompleted }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "foo" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
      expect(onCompleted).toHaveBeenCalledTimes(1);

      void client.refetchQueries({ include: "active" });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "bar" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "foo" },
        variables: {},
      });
      expect(onCompleted).toHaveBeenCalledTimes(1);

      client.writeQuery({ query, data: { hello: "baz" } });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "baz" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "bar" },
        variables: {},
      });
      expect(onCompleted).toHaveBeenCalledTimes(1);

      await expect(takeSnapshot).not.toRerender();
    });

    it("onCompleted should execute on cache writes after initial query execution with notifyOnNetworkStatusChange: true", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "foo" } },
          delay: 20,
        },
        {
          request: { query },
          result: { data: { hello: "bar" } },
          delay: 20,
        },
      ];
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });
      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () =>
          useQuery(query, { onCompleted, notifyOnNetworkStatusChange: true }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "foo" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
      expect(onCompleted).toHaveBeenCalledTimes(1);

      void client.refetchQueries({ include: "active" });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "foo" },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.refetch,
        previousData: { hello: "foo" },
        variables: {},
      });
      expect(onCompleted).toHaveBeenCalledTimes(1);

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "bar" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "foo" },
        variables: {},
      });
      expect(onCompleted).toHaveBeenCalledTimes(2);

      client.writeQuery({ query, data: { hello: "baz" } });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "baz" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "bar" },
        variables: {},
      });
      expect(onCompleted).toHaveBeenCalledTimes(2);

      await expect(takeSnapshot).not.toRerender();
    });
  });

  describe("Optimistic data", () => {
    it("should display rolled back optimistic data when an error occurs", async () => {
      if (IS_REACT_17) {
        // this test is currently broken in React 17 with RTL 16 and needs further investigation
        return;
      }
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
            make: "Audi",
            model: "RS8",
            __typename: "Car",
          },
        ],
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
        make: "Ford",
        model: "Pinto",
        __typename: "Car",
      };

      const allCarsData = {
        cars: [carsData.cars[0], carData],
      };

      const mocks = [
        {
          request: { query },
          result: { data: carsData },
        },
        {
          request: { query: mutation },
          error: new Error("Oh no!"),
          delay: 500,
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => ({
            mutation: useMutation(mutation, {
              optimisticResponse: { addCar: carData },
              update(cache, { data }) {
                cache.modify({
                  fields: {
                    cars(existing, { readField }) {
                      const newCarRef = cache.writeFragment({
                        data: data!.addCar,
                        fragment: gql`
                          fragment NewCar on Car {
                            id
                            make
                            model
                          }
                        `,
                      });

                      if (
                        existing.some(
                          (ref: Reference) =>
                            readField("id", ref) === data!.addCar.id
                        )
                      ) {
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
          { wrapper }
        );

      {
        const { query } = await takeSnapshot();

        expect(query).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const { query } = await takeSnapshot();

        expect(query).toEqualQueryResult({
          data: carsData,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      const mutate = getCurrentSnapshot().mutation[0];
      void mutate();

      {
        // The mutation ran and is loading the result. The query stays at not
        // loading as nothing has changed for the query, but optimistic data is
        // rendered.
        let { query, mutation } = await takeSnapshot();

        while (!mutation[1].loading) {
          // useMutation seems to sometimes have an extra render
          // before it enters `loading` state - this test doesn't test
          // that part of that hook so we just work around it
          ({ query, mutation } = await takeSnapshot());
        }
        expect(mutation[1].loading).toBe(true);
        expect(query).toEqualQueryResult({
          data: allCarsData,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: carsData,
          variables: {},
        });
      }

      expect(onError).toHaveBeenCalledTimes(0);
      {
        const { query, mutation } = await takeSnapshot();
        // The mutation ran and is loading the result. The query stays at
        // not loading as nothing has changed for the query.
        expect(mutation[1].loading).toBe(true);
        expect(query).toEqualQueryResult({
          data: carsData,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: allCarsData,
          variables: {},
        });
      }

      {
        const { query, mutation } = await takeSnapshot();
        // The mutation has completely finished, leaving the query with access to
        // the original cache data.
        expect(mutation[1].loading).toBe(false);
        expect(query).toEqualQueryResult({
          data: carsData,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: allCarsData,
          variables: {},
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toBe("Oh no!");
    });
  });

  describe("Partial refetch", () => {
    it("should attempt a refetch when data is missing and partialRefetch is true", async () => {
      using consoleSpy = spyOnConsole("error");
      const query = gql`
        {
          hello
        }
      `;

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
        () =>
          useQuery(query, {
            partialRefetch: true,
            notifyOnNetworkStatusChange: true,
          }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);

      await waitFor(
        () => {
          expect(result.current.networkStatus).toBe(NetworkStatus.refetch);
        },
        { interval: 1 }
      );
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error.mock.calls[0][0]).toMatch("Missing field");

      await waitFor(
        () => {
          expect(result.current.networkStatus).toBe(NetworkStatus.ready);
        },
        { interval: 1 }
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ hello: "world" });
      expect(result.current.error).toBe(undefined);
    });

    it("should attempt a refetch when data is missing and partialRefetch is true 2", async () => {
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
        allPeople: { people: [{ name: "Luke Skywalker" }] },
      };

      using consoleSpy = spyOnConsole("error");
      const link = mockSingleLink(
        { request: { query }, result: { data: {} }, delay: 20 },
        { request: { query }, result: { data }, delay: 20 }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () =>
          useQuery(query, {
            partialRefetch: true,
            notifyOnNetworkStatusChange: true,
          }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);
      expect(result.current.networkStatus).toBe(NetworkStatus.loading);

      await waitFor(
        () => {
          expect(result.current.networkStatus).toBe(NetworkStatus.refetch);
        },
        { interval: 1 }
      );
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);
      expect(result.current.error).toBe(undefined);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error.mock.calls[0][0]).toMatch("Missing field");

      await waitFor(
        () => {
          expect(result.current.networkStatus).toBe(NetworkStatus.ready);
        },
        { interval: 1 }
      );
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(data);
      expect(result.current.error).toBe(undefined);
    });

    it("should attempt a refetch when data is missing, partialRefetch is true and addTypename is false for the cache", async () => {
      using consoleSpy = spyOnConsole("error");
      const query = gql`
        {
          hello
        }
      `;

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
        <ApolloProvider client={client}>{children}</ApolloProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () =>
          useQuery(query, {
            partialRefetch: true,
            notifyOnNetworkStatusChange: true,
          }),
        { wrapper }
      );

      {
        const result = await takeSnapshot();
        expect(result.loading).toBe(true);
        expect(result.data).toBe(undefined);
        expect(result.error).toBe(undefined);
        expect(result.networkStatus).toBe(NetworkStatus.loading);
      }

      {
        const result = await takeSnapshot();
        expect(result.networkStatus).toBe(NetworkStatus.refetch);
        expect(result.loading).toBe(true);
        expect(result.error).toBe(undefined);
        expect(result.data).toBe(undefined);
      }

      const calls = consoleSpy.error.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toMatch("Missing field");

      {
        const result = await takeSnapshot();
        expect(result.networkStatus).toBe(NetworkStatus.ready);
        expect(result.loading).toBe(false);
        expect(result.data).toEqual({ hello: "world" });
        expect(result.error).toBe(undefined);
      }
    });
  });

  describe("Client Resolvers", () => {
    it("should receive up to date @client(always: true) fields on entity update", async () => {
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
              return data.title.length;
            },
          },
          Query: {
            clientEntity(_root, { id }, { cache }) {
              return cache.readFragment({
                id: cache.identify({ id, __typename: "ClientData" }),
                fragment,
              });
            },
          },
          Mutation: {
            addOrUpdate(_root, { id, title }, { cache }) {
              return cache.writeFragment({
                id: cache.identify({ id, __typename: "ClientData" }),
                fragment,
                data: { id, title, __typename: "ClientData" },
              });
            },
          },
        },
      });

      const entityId = 1;
      const shortTitle = "Short";
      const longerTitle = "A little longer";
      await client.mutate({
        mutation,
        variables: {
          id: entityId,
          title: shortTitle,
        },
      });

      const wrapper = ({ children }: any) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { variables: { id: entityId } }),
        { wrapper }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: entityId },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          clientEntity: {
            id: entityId,
            title: shortTitle,
            titleLength: shortTitle.length,
            __typename: "ClientData",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: entityId },
      });

      void client.mutate({
        mutation,
        variables: {
          id: entityId,
          title: longerTitle,
        },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          clientEntity: {
            id: entityId,
            title: longerTitle,
            titleLength: longerTitle.length,
            __typename: "ClientData",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          clientEntity: {
            id: entityId,
            title: shortTitle,
            titleLength: shortTitle.length,
            __typename: "ClientData",
          },
        },
        variables: { id: entityId },
      });

      await expect(takeSnapshot).not.toRerender();
    });
  });

  describe("Skipping", () => {
    const query = gql`
      query greeting($someVar: Boolean) {
        hello
      }
    `;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: "world" } },
      },
      {
        request: {
          query,
          variables: { someVar: true },
        },
        result: { data: { hello: "world" } },
      },
    ];

    it("should skip running a query when `skip` is `true`", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ skip }) => useQuery(query, { skip }),
        { wrapper, initialProps: { skip: true } }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await rerender({ skip: false });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
    });

    it("should not make network requests when `skip` is `true`", async () => {
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
        <ApolloProvider client={client}>{children}</ApolloProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ skip, variables }) => useQuery(query, { skip, variables }),
        { wrapper, initialProps: { skip: false, variables: undefined as any } }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await rerender({ skip: true, variables: { someVar: true } });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        error: undefined,
        // TODO: It seems odd to flip this back to false after it was already
        // set to true
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "world" },
        variables: { someVar: true },
      });

      expect(linkFn).toHaveBeenCalledTimes(1);
    });

    it("should tear down the query if `skip` is `true`", async () => {
      const client = new ApolloClient({
        link: new ApolloLink(() => Observable.of({ data: { hello: "world" } })),
        cache: new InMemoryCache(),
      });

      const wrapper = ({ children }: any) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      );

      const { unmount } = renderHook(() => useQuery(query, { skip: true }), {
        wrapper,
      });

      expect(client.getObservableQueries("all").size).toBe(1);
      unmount();
      await new Promise((resolve) => setTimeout(resolve));
      expect(client.getObservableQueries("all").size).toBe(0);
    });

    it("should treat fetchPolicy standby like skip", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ fetchPolicy }) => useQuery(query, { fetchPolicy }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
          initialProps: { fetchPolicy: "standby" as any },
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await rerender({ fetchPolicy: "cache-first" });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
    });

    // Amusingly, #8270 thinks this is a bug, but #9101 thinks this is not.
    it("should refetch when skip is true", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const link = new ApolloLink(() =>
        Observable.of({
          data: { hello: "world" },
        })
      );

      const requestSpy = jest.spyOn(link, "request");
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { skip: true }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      const refetchResult = await getCurrentSnapshot().refetch();

      expect(refetchResult).toEqualApolloQueryResult({
        data: { hello: "world" },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      expect(requestSpy).toHaveBeenCalledTimes(1);
      requestSpy.mockRestore();

      await expect(takeSnapshot).not.toRerender();
    });

    it("should set correct initialFetchPolicy even if skip:true", async () => {
      const query = gql`
        {
          hello
        }
      `;
      let linkCount = 0;
      const link = new ApolloLink(() =>
        Observable.of({
          data: { hello: ++linkCount },
        })
      );

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      const correctInitialFetchPolicy: WatchQueryFetchPolicy =
        "cache-and-network";

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot, rerender } =
        await renderHookToSnapshotStream(
          ({ skip }) =>
            useQuery(query, {
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
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      function check(
        expectedFetchPolicy: WatchQueryFetchPolicy,
        expectedInitialFetchPolicy: WatchQueryFetchPolicy
      ) {
        const { observable } = getCurrentSnapshot();
        const { fetchPolicy, initialFetchPolicy } = observable.options;

        expect(fetchPolicy).toBe(expectedFetchPolicy);
        expect(initialFetchPolicy).toBe(expectedInitialFetchPolicy);
      }

      check("standby", correctInitialFetchPolicy);

      await rerender({ skip: false });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: 1 },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      check(correctInitialFetchPolicy, correctInitialFetchPolicy);

      const reasons: string[] = [];

      const result = await getCurrentSnapshot().observable.reobserve({
        variables: {
          newVar: true,
        },
        nextFetchPolicy(currentFetchPolicy, context) {
          expect(currentFetchPolicy).toBe("cache-and-network");
          expect(context.initialFetchPolicy).toBe("cache-and-network");
          reasons.push(context.reason);
          return currentFetchPolicy;
        },
      });

      expect(result).toEqualApolloQueryResult({
        data: { hello: 2 },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });
      expect(reasons).toEqual(["variables-changed", "after-fetch"]);

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: 1 },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: { hello: 1 },
        variables: { newVar: true },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: 2 },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: 1 },
        variables: { newVar: true },
      });

      await expect(takeSnapshot).not.toRerender();
    });

    it("should prioritize a `nextFetchPolicy` function over a `fetchPolicy` option when changing variables", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const link = new MockLink([
        {
          request: { query, variables: { id: 1 } },
          result: { data: { hello: "from link" } },
          delay: 10,
        },
        {
          request: { query, variables: { id: 2 } },
          result: { data: { hello: "from link2" } },
          delay: 10,
        },
      ]);

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      const mocks = mockFetchQuery(client["queryManager"]);

      const expectQueryTriggered = (
        nth: number,
        fetchPolicy: WatchQueryFetchPolicy
      ) => {
        expect(mocks.fetchQueryByPolicy).toHaveBeenCalledTimes(nth);
        expect(mocks.fetchQueryByPolicy).toHaveBeenNthCalledWith(
          nth,
          expect.anything(),
          expect.objectContaining({ fetchPolicy }),
          expect.any(Number)
        );
      };
      const nextFetchPolicy: WatchQueryOptions<
        OperationVariables,
        any
      >["nextFetchPolicy"] = jest.fn((_, context) => {
        if (context.reason === "variables-changed") {
          return "cache-and-network";
        } else if (context.reason === "after-fetch") {
          return "cache-only";
        }
        throw new Error("should never happen");
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot, rerender } =
        await renderHookToSnapshotStream(
          ({ variables }) =>
            useQuery(query, {
              fetchPolicy: "network-only",
              variables,
              notifyOnNetworkStatusChange: true,
              nextFetchPolicy,
            }),
          {
            initialProps: {
              variables: { id: 1 },
            },
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      await tick();

      // first network request triggers with initial fetchPolicy
      expectQueryTriggered(1, "network-only");

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "from link" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(nextFetchPolicy).toHaveBeenCalledTimes(1);
      expect(nextFetchPolicy).toHaveBeenNthCalledWith(
        1,
        "network-only",
        expect.objectContaining({ reason: "after-fetch" })
      );
      // `nextFetchPolicy(..., {reason: "after-fetch"})` changed it to
      // cache-only
      expect(getCurrentSnapshot().observable.options.fetchPolicy).toBe(
        "cache-only"
      );

      await rerender({
        variables: { id: 2 },
      });

      expect(nextFetchPolicy).toHaveBeenNthCalledWith(
        2,
        // has been reset to the initial `fetchPolicy` of "network-only" because
        // we changed variables, then `nextFetchPolicy` is called
        "network-only",
        expect.objectContaining({
          reason: "variables-changed",
        })
      );
      // the return value of `nextFetchPolicy(..., {reason: "variables-changed"})`
      expectQueryTriggered(2, "cache-and-network");

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        // TODO: Shouldn't this be undefined?
        data: { hello: "from link" },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: { hello: "from link" },
        variables: { id: 2 },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "from link2" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "from link" },
        variables: { id: 2 },
      });

      expect(nextFetchPolicy).toHaveBeenCalledTimes(3);
      expect(nextFetchPolicy).toHaveBeenNthCalledWith(
        3,
        "cache-and-network",
        expect.objectContaining({
          reason: "after-fetch",
        })
      );
      // `nextFetchPolicy(..., {reason: "after-fetch"})` changed it to
      // cache-only
      expect(getCurrentSnapshot().observable.options.fetchPolicy).toBe(
        "cache-only"
      );

      await expect(takeSnapshot).not.toRerender();
    });
  });

  describe("Missing Fields", () => {
    it("should log debug messages about MissingFieldErrors from the cache", async () => {
      using consoleSpy = spyOnConsole("error");

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
            make: "Audi",
            model: "RS8",
            vine: "DOLLADOLLABILL",
            __typename: "Car",
          },
        ],
      };

      const mocks = [
        {
          request: { query: carQuery, variables: { id: 1 } },
          result: { data: carData },
        },
      ];

      const cache = new InMemoryCache();
      const wrapper = ({ children }: any) => (
        <MockedProvider mocks={mocks} cache={cache}>
          {children}
        </MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(carQuery, { variables: { id: 1 } }),
        { wrapper }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: carData,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });

      expect(consoleSpy.error).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenLastCalledWith(
        `Missing field '%s' while writing result %o`,
        "vin",
        {
          id: 1,
          make: "Audi",
          model: "RS8",
          vine: "DOLLADOLLABILL",
          __typename: "Car",
        }
      );

      await expect(takeSnapshot).not.toRerender();
    });

    it("should return partial cache data when `returnPartialData` is true", async () => {
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
              __typename: "Car",
              make: "Ford",
              model: "Mustang",
              vin: "PONY123",
              repairs: [
                {
                  __typename: "Repair",
                  date: "2019-05-08",
                  description: "Could not get after it.",
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(partialQuery, { returnPartialData: true }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          cars: [
            {
              __typename: "Car",
              repairs: [
                {
                  __typename: "Repair",
                  date: "2019-05-08",
                },
              ],
            },
          ],
        },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    });

    it("should not return partial cache data when `returnPartialData` is false", async () => {
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
              __typename: "Car",
              make: "Ford",
              model: "Mustang",
              vin: "PONY123",
              repairs: [
                {
                  __typename: "Repair",
                  date: "2019-05-08",
                  description: "Could not get after it.",
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(partialQuery, { returnPartialData: false }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    });

    it("should not return partial cache data when `returnPartialData` is false and new variables are passed in", async () => {
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      const query = gql`
        query MyCar($id: ID) {
          car(id: $id) {
            id
            make
          }
        }
      `;

      const partialQuery = gql`
        query MyCar($id: ID) {
          car(id: $id) {
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
            __typename: "Car",
            id: 1,
            make: "Ford",
            model: "Pinto",
          },
        },
      });

      cache.writeQuery({
        query: partialQuery,
        variables: { id: 2 },
        data: {
          car: {
            __typename: "Car",
            id: 2,
            make: "Ford",
            model: "Pinto",
          },
        },
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ id }) => {
          return useQuery(partialQuery, {
            variables: { id },
            returnPartialData: false,
            notifyOnNetworkStatusChange: true,
          });
        },
        {
          initialProps: { id: 2 },
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          car: {
            __typename: "Car",
            id: 2,
            make: "Ford",
            model: "Pinto",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 2 },
      });

      await rerender({ id: 1 });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: {
          car: {
            __typename: "Car",
            id: 2,
            make: "Ford",
            model: "Pinto",
          },
        },
        variables: { id: 1 },
      });
    });
  });

  describe("Previous data", () => {
    it("should persist previous data when a query is re-run", async () => {
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
          make: "Venturi",
          __typename: "Car",
        },
      };

      const data2 = {
        car: {
          id: 2,
          make: "Wiesmann",
          __typename: "Car",
        },
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { notifyOnNetworkStatusChange: true }),
          { wrapper }
        );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: data1,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await getCurrentSnapshot().refetch();

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: data1,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.refetch,
        previousData: data1,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: data2,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: data1,
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
    });

    it("should persist result.previousData across multiple results", async () => {
      const query: TypedDocumentNode<
        {
          car: {
            id: number;
            make: string;
            __typename: "Car";
          };
        },
        {
          vin?: string;
        }
      > = gql`
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
          make: "Venturi",
          __typename: "Car" as const,
        },
      };

      const data2 = {
        car: {
          id: 2,
          make: "Wiesmann",
          __typename: "Car" as const,
        },
      };

      const data3 = {
        car: {
          id: 3,
          make: "Beetle",
          __typename: "Car" as const,
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useQuery(query, { notifyOnNetworkStatusChange: true }),
          { wrapper }
        );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: data1,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => getCurrentSnapshot().refetch());

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: data1,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.refetch,
        previousData: data1,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: data2,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: data1,
        variables: {},
      });

      void getCurrentSnapshot().refetch({ vin: "ABCDEFG0123456789" });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: data2,
        variables: { vin: "ABCDEFG0123456789" },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: data3,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: data2,
        variables: { vin: "ABCDEFG0123456789" },
      });

      await expect(takeSnapshot).not.toRerender();
    });

    it("should persist result.previousData even if query changes", async () => {
      const aQuery: TypedDocumentNode<{
        a: string;
      }> = gql`
        query A {
          a
        }
      `;

      const abQuery: TypedDocumentNode<{
        a: string;
        b: number;
      }> = gql`
        query AB {
          a
          b
        }
      `;

      const bQuery: TypedDocumentNode<{
        b: number;
      }> = gql`
        query B {
          b
        }
      `;

      let stringOfAs = "";
      let countOfBs = 0;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          (request) =>
            new Observable((observer) => {
              switch (request.operationName) {
                case "A": {
                  observer.next({
                    data: {
                      a: (stringOfAs += "a"),
                    },
                  });
                  break;
                }
                case "AB": {
                  observer.next({
                    data: {
                      a: (stringOfAs += "a"),
                      b: (countOfBs += 1),
                    },
                  });
                  break;
                }
                case "B": {
                  observer.next({
                    data: {
                      b: (countOfBs += 1),
                    },
                  });
                  break;
                }
              }
              setTimeout(() => {
                observer.complete();
              }, 10);
            })
        ),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot, rerender } =
        await renderHookToSnapshotStream(
          ({ query }) => {
            return useQuery(query, {
              fetchPolicy: "cache-and-network",
              notifyOnNetworkStatusChange: true,
            });
          },
          {
            initialProps: { query: aQuery as DocumentNode },
            wrapper: ({ children }: any) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { a: "a" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await rerender({ query: abQuery });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: { a: "a" },
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { a: "aa", b: 1 },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { a: "a" },
        variables: {},
      });

      const result = await getCurrentSnapshot().reobserve();

      expect(result).toEqualApolloQueryResult({
        data: { a: "aaa", b: 2 },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { a: "aa", b: 1 },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: { a: "aa", b: 1 },
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { a: "aaa", b: 2 },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { a: "aa", b: 1 },
        variables: {},
      });

      await rerender({ query: bQuery });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { b: 2 },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: { a: "aaa", b: 2 },
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { b: 3 },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { b: 2 },
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
    });

    // TODO: Determine if this test is needed or is already covered by other
    // tests such as changing variables (since those tests check all returned
    // hook properties)
    it("should be cleared when variables change causes cache miss", async () => {
      const peopleData = [
        { id: 1, name: "John Smith", gender: "male", __typename: "Person" },
        { id: 2, name: "Sara Smith", gender: "female", __typename: "Person" },
        { id: 3, name: "Budd Deey", gender: "nonbinary", __typename: "Person" },
        {
          id: 4,
          name: "Johnny Appleseed",
          gender: "male",
          __typename: "Person",
        },
        { id: 5, name: "Ada Lovelace", gender: "female", __typename: "Person" },
      ];

      const link = new ApolloLink((operation) => {
        return new Observable((observer) => {
          const { gender } = operation.variables;
          void wait(300).then(() => {
            observer.next({
              data: {
                people:
                  gender === "all" ? peopleData
                  : gender ?
                    peopleData.filter((person) => person.gender === gender)
                  : peopleData,
              },
            });
            observer.complete();
          });
        });
      });

      type Person = {
        __typename: string;
        id: number;
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
        ({ gender }: { gender: string }) =>
          useQuery(query, {
            variables: { gender },
            fetchPolicy: "network-only",
          }),
        { wrapper, initialProps: { gender: "all" } }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { gender: "all" },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          people: peopleData.map(({ gender, ...person }) => person),
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { gender: "all" },
      });

      await rerender({ gender: "female" });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: {
          people: peopleData.map(({ gender, ...person }) => person),
        },
        variables: { gender: "female" },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          people: peopleData
            .filter((person) => person.gender === "female")
            .map(({ gender, ...person }) => person),
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          people: peopleData.map(({ gender, ...person }) => person),
        },
        variables: { gender: "female" },
      });

      await expect(takeSnapshot).not.toRerender();
    });
  });

  describe("defaultOptions", () => {
    it("should allow polling options to be passed to the client", async () => {
      const query = gql`
        {
          hello
        }
      `;
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
        }
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world 1" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world 2" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "world 1" },
        variables: {},
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { hello: "world 3" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "world 2" },
        variables: {},
      });
    });
  });

  describe("canonical cache results", () => {
    it("can be disabled via useQuery options", async () => {
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
      });

      const wrapper = ({ children }: any) => (
        <MockedProvider cache={cache}>{children}</MockedProvider>
      );

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot, rerender } =
        await renderHookToSnapshotStream(
          ({ canonizeResults }) =>
            useQuery(query, {
              fetchPolicy: "cache-only",
              canonizeResults,
            }),
          { wrapper, initialProps: { canonizeResults: false } }
        );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { results },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      {
        const { data } = getCurrentSnapshot();
        const resultSet = new Set<(typeof results)[0]>(data.results);
        const values = Array.from(resultSet).map((result) => result.value);

        expect(data.results.length).toBe(6);
        // Since canonization is not happening, the duplicate 1 results are
        // returned as distinct objects.
        expect(resultSet.size).toBe(6);
        expect(values).toEqual([0, 1, 1, 2, 3, 5]);
      }

      await rerender({ canonizeResults: true });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { results },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { results },
        variables: {},
      });

      // Check that canonization takes place immediately
      {
        const { data } = getCurrentSnapshot();
        const resultSet = new Set<(typeof results)[0]>(data.results);
        const values = Array.from(resultSet).map((result) => result.value);

        expect(data.results.length).toBe(6);
        // Since canonization is happening now, the duplicate 1 results are
        // returned as identical (===) objects.
        expect(resultSet.size).toBe(5);
        expect(values).toEqual([0, 1, 2, 3, 5]);
      }

      const updatedResults = [...results, { __typename: "Result", value: 8 }];

      // Append another element to the results array, invalidating the
      // array itself, triggering another render (below).
      cache.writeQuery({
        query,
        overwrite: true,
        data: { results: updatedResults },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: { results: updatedResults },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { results },
        variables: {},
      });

      {
        const { data } = getCurrentSnapshot();
        const resultSet = new Set<(typeof results)[0]>(data.results);
        const values = Array.from(resultSet).map((result) => result.value);

        expect(data.results.length).toBe(7);
        // Since canonization is happening now, the duplicate 1 results are
        // returned as identical (===) objects.
        expect(resultSet.size).toBe(6);
        expect(values).toEqual([0, 1, 2, 3, 5, 8]);
      }

      await expect(takeSnapshot).not.toRerender();
    });
  });

  // TODO: Delete this test after PR review since this is a duplicate of the
  // previous one
  describe("canonical cache results", () => {
    it("can be disabled via useQuery options", async () => {
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
      });

      const wrapper = ({ children }: any) => (
        <MockedProvider cache={cache}>{children}</MockedProvider>
      );

      const { result, rerender } = renderHook(
        ({ canonizeResults }) =>
          useQuery(query, {
            fetchPolicy: "cache-only",
            canonizeResults,
          }),
        { wrapper, initialProps: { canonizeResults: false } }
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

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { interval: 1 }
      );
      await waitFor(
        () => {
          expect(result.current.data).toEqual({ results });
        },
        { interval: 1 }
      );
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
    }> = gql`
      query A {
        a {
          id
          name
        }
      }
    `;

    const bQuery: TypedDocumentNode<{
      b: ABFields;
    }> = gql`
      query B {
        b {
          id
          name
        }
      }
    `;

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
        cache: new InMemoryCache(),
        link: new ApolloLink(
          (operation) =>
            new Observable((observer) => {
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
            })
        ),
      });
    }

    async function check(
      aFetchPolicy: WatchQueryFetchPolicy,
      bFetchPolicy: WatchQueryFetchPolicy
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
        }
      );

      expect(result.current.a).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
      expect(result.current.b).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await waitFor(() => {
        expect(result.current.a.loading).toBe(false);
        expect(result.current.b.loading).toBe(false);
      });

      expect(result.current.a).toEqualQueryResult({
        data: aData,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
      expect(result.current.b).toEqualQueryResult({
        data: bData,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    // TODO: Eventually move the "check" code back into these test so we can
    // check them render-by-render with renderHookToSnapshotStream
    it("cache-first for both", () => check("cache-first", "cache-first"));

    it("cache-first first, cache-and-network second", () =>
      check("cache-first", "cache-and-network"));

    it("cache-first first, network-only second", () =>
      check("cache-first", "network-only"));

    it("cache-and-network for both", () =>
      check("cache-and-network", "cache-and-network"));

    it("cache-and-network first, cache-first second", () =>
      check("cache-and-network", "cache-first"));

    it("cache-and-network first, network-only second", () =>
      check("cache-and-network", "network-only"));

    it("network-only for both", () => check("network-only", "network-only"));

    it("network-only first, cache-first second", () =>
      check("network-only", "cache-first"));

    it("network-only first, cache-and-network second", () =>
      check("network-only", "cache-and-network"));
  });

  describe("regression test issue #9204", () => {
    // TODO: See if we can rewrite this with renderHookToSnapshotStream and
    // check output of hook to ensure its a stable object
    it("should handle a simple query", async () => {
      const query = gql`
        {
          hello
        }
      `;
      const mocks = [
        {
          request: { query },
          result: { data: { hello: "world" } },
        },
      ];

      const Component = ({ query }: any) => {
        const [counter, setCounter] = useState(0);
        const result = useQuery(query);

        useEffect(() => {
          /**
           * IF the return value from useQuery changes on each render,
           * this component will re-render in an infinite loop.
           */
          if (counter > 10) {
            console.error(`Too many results (${counter})`);
          } else {
            setCounter((c) => c + 1);
          }
        }, [result, result.data]);

        if (result.loading) return null;

        return (
          <div>
            {result.data.hello}
            {counter}
          </div>
        );
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component query={query} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("world2")).toBeTruthy();
      });
    });
  });

  // https://github.com/apollographql/apollo-client/issues/10222
  describe("regression test issue #10222", () => {
    it("maintains initial fetch policy when component unmounts and remounts", async () => {
      let helloCount = 1;
      const query = gql`
        {
          hello
        }
      `;
      const link = new ApolloLink(() => {
        return new Observable((observer) => {
          const timer = setTimeout(() => {
            observer.next({ data: { hello: `hello ${helloCount++}` } });
            observer.complete();
          }, 50);

          return () => {
            clearTimeout(timer);
          };
        });
      });

      const cache = new InMemoryCache();

      const client = new ApolloClient({
        link,
        cache,
      });

      let setShow: Function;
      const Toggler = ({ children }: { children: ReactNode }) => {
        const [show, _setShow] = useState(true);
        setShow = _setShow;

        return show ? <>{children}</> : null;
      };

      const { result } = renderHook(
        () =>
          useQuery(query, {
            fetchPolicy: "network-only",
            nextFetchPolicy: "cache-first",
          }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              <Toggler>{children}</Toggler>
            </ApolloProvider>
          ),
        }
      );

      expect(result.current).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current).toEqualQueryResult({
        data: { hello: "hello 1" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      expect(cache.readQuery({ query })).toEqual({ hello: "hello 1" });

      act(() => {
        setShow(false);
      });

      act(() => {
        setShow(true);
      });

      expect(result.current).toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current).toEqualQueryResult({
        data: { hello: "hello 2" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      expect(cache.readQuery({ query })).toEqual({ hello: "hello 2" });
    });
  });

  describe("defer", () => {
    it("should handle deferred queries", async () => {
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              greeting: {
                message: "Hello world",
                __typename: "Greeting",
              },
            },
            hasNext: true,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            incremental: [
              {
                data: {
                  recipient: {
                    name: "Alice",
                    __typename: "Person",
                  },
                  __typename: "Greeting",
                },
                path: ["greeting"],
              },
            ],
            hasNext: false,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
            recipient: {
              name: "Alice",
              __typename: "Person",
            },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        },
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
    });

    it("should handle deferred queries in lists", async () => {
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              greetings: [
                { message: "Hello world", __typename: "Greeting" },
                { message: "Hello again", __typename: "Greeting" },
              ],
            },
            hasNext: true,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greetings: [
            { message: "Hello world", __typename: "Greeting" },
            { message: "Hello again", __typename: "Greeting" },
          ],
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            incremental: [
              {
                data: {
                  recipient: {
                    name: "Alice",
                    __typename: "Person",
                  },
                  __typename: "Greeting",
                },
                path: ["greetings", 0],
              },
            ],
            hasNext: true,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greetings: [
            {
              message: "Hello world",
              __typename: "Greeting",
              recipient: { name: "Alice", __typename: "Person" },
            },
            { message: "Hello again", __typename: "Greeting" },
          ],
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          greetings: [
            { message: "Hello world", __typename: "Greeting" },
            { message: "Hello again", __typename: "Greeting" },
          ],
        },
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            incremental: [
              {
                data: {
                  recipient: {
                    name: "Bob",
                    __typename: "Person",
                  },
                  __typename: "Greeting",
                },
                path: ["greetings", 1],
              },
            ],
            hasNext: false,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greetings: [
            {
              message: "Hello world",
              __typename: "Greeting",
              recipient: { name: "Alice", __typename: "Person" },
            },
            {
              message: "Hello again",
              __typename: "Greeting",
              recipient: { name: "Bob", __typename: "Person" },
            },
          ],
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          greetings: [
            {
              message: "Hello world",
              __typename: "Greeting",
              recipient: { name: "Alice", __typename: "Person" },
            },
            { message: "Hello again", __typename: "Greeting" },
          ],
        },
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
    });

    it("should handle deferred queries in lists, merging arrays", async () => {
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

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              allProducts: [
                {
                  __typename: "Product",
                  delivery: {
                    __typename: "DeliveryEstimates",
                  },
                  id: "apollo-federation",
                  sku: "federation",
                },
                {
                  __typename: "Product",
                  delivery: {
                    __typename: "DeliveryEstimates",
                  },
                  id: "apollo-studio",
                  sku: "studio",
                },
              ],
            },
            hasNext: true,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          allProducts: [
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
              },
              id: "apollo-federation",
              sku: "federation",
            },
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
              },
              id: "apollo-studio",
              sku: "studio",
            },
          ],
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

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
                path: ["allProducts", 0, "delivery"],
              },
              {
                data: {
                  __typename: "DeliveryEstimates",
                  estimatedDelivery: "6/25/2021",
                  fastestDelivery: "6/24/2021",
                },
                path: ["allProducts", 1, "delivery"],
              },
            ],
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          allProducts: [
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
                estimatedDelivery: "6/25/2021",
                fastestDelivery: "6/24/2021",
              },
              id: "apollo-federation",
              sku: "federation",
            },
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
                estimatedDelivery: "6/25/2021",
                fastestDelivery: "6/24/2021",
              },
              id: "apollo-studio",
              sku: "studio",
            },
          ],
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          allProducts: [
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
              },
              id: "apollo-federation",
              sku: "federation",
            },
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
              },
              id: "apollo-studio",
              sku: "studio",
            },
          ],
        },
        variables: {},
      });
    });

    it("should handle deferred queries with fetch policy no-cache", async () => {
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { fetchPolicy: "no-cache" }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              greeting: {
                message: "Hello world",
                __typename: "Greeting",
              },
            },
            hasNext: true,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            incremental: [
              {
                data: {
                  recipient: {
                    name: "Alice",
                    __typename: "Person",
                  },
                  __typename: "Greeting",
                },
                path: ["greeting"],
              },
            ],
            hasNext: false,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
            recipient: {
              name: "Alice",
              __typename: "Person",
            },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        },
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
    });

    it("should handle deferred queries with errors returned on the incremental batched result", async () => {
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              hero: {
                name: "R2-D2",
                heroFriends: [
                  {
                    id: "1000",
                    name: "Luke Skywalker",
                  },
                  {
                    id: "1003",
                    name: "Leia Organa",
                  },
                ],
              },
            },
            hasNext: true,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

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
                  ),
                ],
                data: {
                  homeWorld: null,
                },
              },
              {
                path: ["hero", "heroFriends", 1],
                data: {
                  homeWorld: "Alderaan",
                },
              },
            ],
            hasNext: false,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        error: new ApolloError({
          graphQLErrors: [
            {
              message:
                "homeWorld for character with ID 1000 could not be fetched.",
              path: ["hero", "heroFriends", 0, "homeWorld"],
            },
          ],
        }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
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

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { errorPolicy: "all" }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      setTimeout(() => {
        link.simulateResult({
          result: {
            data: {
              hero: {
                name: "R2-D2",
                heroFriends: [
                  {
                    id: "1000",
                    name: "Luke Skywalker",
                  },
                  {
                    id: "1003",
                    name: "Leia Organa",
                  },
                ],
              },
            },
            hasNext: true,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          hero: {
            name: "R2-D2",
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

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
                  ),
                ],
                data: {
                  homeWorld: null,
                },
                extensions: {
                  thing1: "foo",
                  thing2: "bar",
                },
              },
              {
                path: ["hero", "heroFriends", 1],
                data: {
                  homeWorld: "Alderaan",
                },
                extensions: {
                  thing1: "foo",
                  thing2: "bar",
                },
              },
            ],
            hasNext: false,
          },
        });
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          hero: {
            heroFriends: [
              {
                // the only difference with the previous test
                // is that homeWorld is populated since errorPolicy: all
                // populates both partial data and error.graphQLErrors
                homeWorld: null,
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                // homeWorld is populated due to errorPolicy: all
                homeWorld: "Alderaan",
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        error: new ApolloError({
          graphQLErrors: [
            {
              message:
                "homeWorld for character with ID 1000 could not be fetched.",
              path: ["hero", "heroFriends", 0, "homeWorld"],
            },
          ],
        }),
        errors: [
          {
            message:
              "homeWorld for character with ID 1000 could not be fetched.",
            path: ["hero", "heroFriends", 0, "homeWorld"],
          },
        ],
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
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
            __typename: "Greeting",
            message: "Hello cached",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useQuery(query, { fetchPolicy: "cache-and-network" }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello cached",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      link.simulateResult({
        result: {
          data: {
            greeting: { __typename: "Greeting", message: "Hello world" },
          },
          hasNext: true,
        },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          greeting: {
            __typename: "Greeting",
            message: "Hello cached",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        variables: {},
      });

      link.simulateResult({
        result: {
          incremental: [
            {
              data: {
                recipient: { name: "Alice", __typename: "Person" },
                __typename: "Greeting",
              },
              path: ["greeting"],
            },
          ],
          hasNext: false,
        },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Alice" },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
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
      {
        using _consoleSpy = spyOnConsole("error");
        cache.writeQuery({
          query,
          data: {
            greeting: {
              __typename: "Greeting",
              recipient: { __typename: "Person", name: "Cached Alice" },
            },
          },
        });
      }

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () =>
          useQuery(query, {
            fetchPolicy: "cache-first",
            returnPartialData: true,
          }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            __typename: "Greeting",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });

      link.simulateResult({
        result: {
          data: {
            greeting: { message: "Hello world", __typename: "Greeting" },
          },
          hasNext: true,
        },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          greeting: {
            __typename: "Greeting",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        variables: {},
      });

      link.simulateResult({
        result: {
          incremental: [
            {
              data: {
                __typename: "Greeting",
                recipient: { name: "Alice", __typename: "Person" },
              },
              path: ["greeting"],
            },
          ],
          hasNext: false,
        },
      });

      await expect(takeSnapshot()).resolves.toEqualQueryResult({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Alice" },
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        variables: {},
      });

      await expect(takeSnapshot).not.toRerender();
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
        shouldFetchOnSecondRender: boolean,
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
      async (
        policy,
        initialQueryValue,
        shouldFetchOnFirstRender,
        shouldFetchOnSecondRender
      ) => {
        const query: TypedDocumentNode<TestQueryValue> = gql`
          query CallMe {
            something
          }
        `;

        const link = new MockLink([
          { request: { query }, result: { data: { something: "bar" } } },
          { request: { query }, result: { data: { something: "baz" } } },
        ]);
        const requestSpy = jest.spyOn(link, "request");

        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link,
        });
        if (initialQueryValue) {
          client.writeQuery({ query, data: initialQueryValue });
        }
        client.disableNetworkFetches = true;

        const { rerender } = renderHook(
          () =>
            useQuery(query, { fetchPolicy: policy, nextFetchPolicy: policy }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

        expect(requestSpy).toHaveBeenCalledTimes(
          shouldFetchOnFirstRender ? 1 : 0
        );

        // We need to wait a moment before the rerender for everything to settle down.
        // This part is unfortunately bound to be flaky - but in some cases there is
        // just nothing to "wait for", except "a moment".
        await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

        requestSpy.mockClear();
        client.disableNetworkFetches = false;

        rerender();
        expect(requestSpy).toHaveBeenCalledTimes(
          shouldFetchOnSecondRender ? 1 : 0
        );
      }
    );
  });

  test("calling `clearStore` while a query is running puts the hook into an error state", async () => {
    const query = gql`
      query {
        hello
      }
    `;

    const link = new MockSubscriptionLink();
    let requests = 0;
    link.onSetup(() => requests++);
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await wait(10);
    expect(requests).toBe(1);

    await expect(takeSnapshot()).resolves.toEqualQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });

    await client.clearStore();

    await expect(takeSnapshot()).resolves.toEqualQueryResult({
      data: undefined,
      error: new ApolloError({
        networkError: new InvariantError(
          "Store reset while query was in flight (not completed in link chain)"
        ),
      }),
      called: true,
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables: {},
    });

    link.simulateResult({ result: { data: { hello: "Greetings" } } }, true);
    await expect(takeSnapshot).not.toRerender({ timeout: 50 });
    expect(requests).toBe(1);
  });

  // https://github.com/apollographql/apollo-client/issues/11938
  it("does not emit `data` on previous fetch when a 2nd fetch is kicked off and the result returns an error when errorPolicy is none", async () => {
    const query = gql`
      query {
        user {
          id
          name
        }
      }
    `;

    const graphQLError: GraphQLFormattedError = { message: "Cannot get name" };

    const mocks = [
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", id: "1", name: null } },
          errors: [graphQLError],
        },
        delay: 10,
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () => useQuery(query, { notifyOnNetworkStatusChange: true }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

    await expect(takeSnapshot()).resolves.toEqualQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });

    await expect(takeSnapshot()).resolves.toEqualQueryResult({
      data: undefined,
      error: new ApolloError({ graphQLErrors: [graphQLError] }),
      called: true,
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables: {},
    });

    const { refetch } = getCurrentSnapshot();

    refetch().catch(() => {});
    refetch().catch(() => {});

    await expect(takeSnapshot()).resolves.toEqualQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.refetch,
      previousData: undefined,
      variables: {},
    });

    await expect(takeSnapshot()).resolves.toEqualQueryResult({
      data: undefined,
      error: new ApolloError({ graphQLErrors: [graphQLError] }),
      called: true,
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables: {},
    });

    await expect(takeSnapshot).not.toRerender({ timeout: 200 });
  });

  describe("data masking", () => {
    it("masks queries when dataMasking is `true`", async () => {
      type UserFieldsFragment = {
        __typename: "User";
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      const query: TypedDocumentNode<Query, Record<string, never>> = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: "Test User",
                age: 30,
              },
            },
          },
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const renderStream =
        createRenderStream<QueryResult<Query, Record<string, never>>>();

      function App() {
        const result = useQuery(query);

        renderStream.replaceSnapshot(result);

        return null;
      }

      using _disabledAct = disableActEnvironment();
      await renderStream.render(<App />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(renderStream).not.toRerender();
    });

    it("does not mask query when dataMasking is `false`", async () => {
      type UserFieldsFragment = {
        __typename: "User";
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      // We have to use Unmasked here since the default is to preserve types
      const query: TypedDocumentNode<
        Unmasked<Query>,
        Record<string, never>
      > = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: "Test User",
                age: 30,
              },
            },
          },
        },
      ];

      const client = new ApolloClient({
        dataMasking: false,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const renderStream =
        createRenderStream<
          QueryResult<Unmasked<Query>, Record<string, never>>
        >();

      function App() {
        const result = useQuery(query);

        renderStream.replaceSnapshot(result);

        return null;
      }

      using _disabledAct = disableActEnvironment();
      await renderStream.render(<App />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      // loading
      await renderStream.takeRender();

      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toEqualQueryResult({
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });

      await expect(renderStream).not.toRerender();
    });

    it("does not mask query by default", async () => {
      type UserFieldsFragment = {
        __typename: "User";
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      const query: TypedDocumentNode<
        Unmasked<Query>,
        Record<string, never>
      > = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: "Test User",
                age: 30,
              },
            },
          },
        },
      ];

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const renderStream =
        createRenderStream<
          QueryResult<Unmasked<Query>, Record<string, never>>
        >();

      function App() {
        const result = useQuery(query);

        renderStream.replaceSnapshot(result);

        return null;
      }

      using _disabledAct = disableActEnvironment();
      await renderStream.render(<App />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      // loading
      await renderStream.takeRender();

      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toEqualQueryResult({
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    });

    it("masks queries updated by the cache", async () => {
      type UserFieldsFragment = {
        __typename: "User";
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      const query: TypedDocumentNode<Query, Record<string, never>> = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: "Test User",
                age: 30,
              },
            },
          },
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const renderStream =
        createRenderStream<QueryResult<Query, Record<string, never>>>();

      function App() {
        const result = useQuery(query);

        renderStream.replaceSnapshot(result);

        return null;
      }

      using _disabledAct = disableActEnvironment();
      await renderStream.render(<App />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      // loading
      await renderStream.takeRender();

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      client.writeQuery({
        query,
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User (updated)",
            age: 35,
          },
        },
      });

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User (updated)",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
            },
          },
          variables: {},
        });
      }
    });

    it("does not rerender when updating field in named fragment", async () => {
      type UserFieldsFragment = {
        __typename: "User";
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      const query: TypedDocumentNode<Query, Record<string, never>> = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: "Test User",
                age: 30,
              },
            },
          },
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const renderStream =
        createRenderStream<QueryResult<Query, Record<string, never>>>();

      function App() {
        const result = useQuery(query);

        renderStream.replaceSnapshot(result);

        return null;
      }

      using _disabledAct = disableActEnvironment();
      await renderStream.render(<App />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      // loading
      await renderStream.takeRender();

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      client.writeQuery({
        query,
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 35,
          },
        },
      });

      await expect(renderStream).not.toRerender();

      expect(client.readQuery({ query })).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 35,
        },
      });
    });

    it.each(["cache-first", "cache-only"] as FetchPolicy[])(
      "masks result from cache when using with %s fetch policy",
      async (fetchPolicy) => {
        type UserFieldsFragment = {
          __typename: "User";
          age: number;
        } & { " $fragmentName"?: "UserFieldsFragment" };

        interface Query {
          currentUser: {
            __typename: "User";
            id: number;
            name: string;
          } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
        }

        const query: TypedDocumentNode<Query, Record<string, never>> = gql`
          query MaskedQuery {
            currentUser {
              id
              name
              ...UserFields
            }
          }

          fragment UserFields on User {
            age
          }
        `;

        const mocks = [
          {
            request: { query },
            result: {
              data: {
                currentUser: {
                  __typename: "User",
                  id: 1,
                  name: "Test User",
                  age: 30,
                },
              },
            },
          },
        ];

        const client = new ApolloClient({
          dataMasking: true,
          cache: new InMemoryCache(),
          link: new MockLink(mocks),
        });

        client.writeQuery({
          query,
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        });

        const renderStream =
          createRenderStream<QueryResult<Query, Record<string, never>>>();

        function App() {
          const result = useQuery(query, { fetchPolicy });

          renderStream.replaceSnapshot(result);

          return null;
        }

        using _disabledAct = disableActEnvironment();
        await renderStream.render(<App />, {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        });

        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }
    );

    it("masks cache and network result when using cache-and-network fetch policy", async () => {
      type UserFieldsFragment = {
        __typename: "User";
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      const query: TypedDocumentNode<Query, Record<string, never>> = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: "Test User (server)",
                age: 35,
              },
            },
          },
          delay: 20,
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      client.writeQuery({
        query,
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 34,
          },
        },
      });

      const renderStream =
        createRenderStream<QueryResult<Query, Record<string, never>>>();

      function App() {
        const result = useQuery(query, { fetchPolicy: "cache-and-network" });

        renderStream.replaceSnapshot(result);

        return null;
      }

      using _disabledAct = disableActEnvironment();
      await renderStream.render(<App />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
            },
          },
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User (server)",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
            },
          },
          variables: {},
        });
      }
    });

    it("masks partial cache data when returnPartialData is `true`", async () => {
      type UserFieldsFragment = {
        __typename: "User";
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      const query: TypedDocumentNode<Query, Record<string, never>> = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: "Test User (server)",
                age: 35,
              },
            },
          },
          delay: 20,
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      {
        using _ = spyOnConsole("error");

        client.writeQuery({
          query,
          data: {
            // @ts-expect-error writing partial result
            currentUser: {
              __typename: "User",
              id: 1,
              age: 34,
            },
          },
        });
      }

      const renderStream =
        createRenderStream<QueryResult<Query, Record<string, never>>>();

      function App() {
        const result = useQuery(query, { returnPartialData: true });

        renderStream.replaceSnapshot(result);

        return null;
      }

      using _disabledAct = disableActEnvironment();
      await renderStream.render(<App />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
            },
          } as Query,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User (server)",
            },
          },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: {
            currentUser: {
              __typename: "User",
              id: 1,
            },
          } as Query,
          variables: {},
        });
      }
    });

    it("masks partial data returned from data on errors with errorPolicy `all`", async () => {
      type UserFieldsFragment = {
        __typename: "User";
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string | null;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      const query: TypedDocumentNode<Query, Record<string, never>> = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: null,
                age: 34,
              },
            },
            errors: [new GraphQLError("Couldn't get name")],
          },
          delay: 20,
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const renderStream =
        createRenderStream<QueryResult<Query, Record<string, never>>>();

      function App() {
        const result = useQuery(query, { errorPolicy: "all" });

        renderStream.replaceSnapshot(result);

        return null;
      }

      using _disabledAct = disableActEnvironment();
      await renderStream.render(<App />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      // loading
      await renderStream.takeRender();

      {
        const { snapshot } = await renderStream.takeRender();

        expect(snapshot).toEqualQueryResult({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: null,
            },
          },
          error: new ApolloError({
            graphQLErrors: [new GraphQLError("Couldn't get name")],
          }),
          errors: [{ message: "Couldn't get name" }],
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }
    });
  });
});

describe.skip("Type Tests", () => {
  test("NoInfer prevents adding arbitrary additional variables", () => {
    const typedNode = {} as TypedDocumentNode<{ foo: string }, { bar: number }>;
    const { variables } = useQuery(typedNode, {
      variables: {
        bar: 4,
        // @ts-expect-error
        nonExistingVariable: "string",
      },
    });
    variables?.bar;
    // @ts-expect-error
    variables?.nonExistingVariable;
  });
});
