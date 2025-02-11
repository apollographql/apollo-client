import { act, renderHook, waitFor } from "@testing-library/react";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { expectTypeOf } from "expect-type";
import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";
import React from "react";
import { Observable } from "rxjs";

import {
  ApolloClient,
  ApolloError,
  ApolloLink,
  ErrorPolicy,
  InMemoryCache,
  NetworkStatus,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from "@apollo/client/core";
import { Masked, MaskedDocumentNode, Unmasked } from "@apollo/client/masking";
import { ApolloProvider } from "@apollo/client/react";
import {
  MockLink,
  mockSingleLink,
  MockSubscriptionLink,
  tick,
  wait,
} from "@apollo/client/testing";
import { MockedProvider } from "@apollo/client/testing/react";
import { DeepPartial } from "@apollo/client/utilities";
import { InvariantError } from "@apollo/client/utilities/invariant";

import {
  setupSimpleCase,
  setupVariablesCase,
  VariablesCaseVariables,
} from "../../../testing/internal/index.js";
import { QueryResult } from "../../types/types.js";
import { useLazyQuery } from "../useLazyQuery.js";

const IS_REACT_17 = React.version.startsWith("17");
const IS_REACT_18 = React.version.startsWith("18");

describe("useLazyQuery Hook", () => {
  const helloQuery: TypedDocumentNode<{
    hello: string;
  }> = gql`
    query {
      hello
    }
  `;

  it("should hold query execution until manually triggered", async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: "world" } },
        delay: 50,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useLazyQuery(helloQuery), {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();
    const result = await execute();

    expect(result).toEqualLazyQueryResult({
      data: { hello: "world" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });

    // TODO: Determine if this first loading state makes sense without notifyOnNetworkStatusChange
    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }
  });

  it("should set `called` to false by default", async () => {
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useLazyQuery(helloQuery),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={[]}>{children}</MockedProvider>
        ),
      }
    );

    const [, { called }] = await takeSnapshot();

    expect(called).toBe(false);
  });

  it("should set `called` to true after calling the lazy execute function", async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: "world" } },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useLazyQuery(helloQuery), {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      });

    {
      const [, { loading, called }] = await takeSnapshot();
      expect(loading).toBe(false);
      expect(called).toBe(false);
    }

    const execute = getCurrentSnapshot()[0];
    setTimeout(() => execute());

    {
      const [, { loading, called }] = await takeSnapshot();
      expect(loading).toBe(true);
      expect(called).toBe(true);
    }

    {
      const [, { loading, called }] = await takeSnapshot();
      expect(loading).toBe(false);
      expect(called).toBe(true);
    }
  });

  it("should use variables passed to execute function when running the lazy execution function", async () => {
    const query = gql`
      query ($id: number) {
        hello(id: $id)
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: 1 } },
        result: { data: { hello: "world 1" } },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useLazyQuery(query), {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();
    const result = await execute({ variables: { id: 1 } });

    expect(result).toEqualLazyQueryResult({
      data: { hello: "world 1" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: 1 },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });
    }
    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 1" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }
  });

  // TODO: Remove this test after we resolve the TODO comment inside of this
  // test.
  it.skip("should merge variables from original hook and execution function", async () => {
    const counterQuery: TypedDocumentNode<
      {
        counter: number;
        vars: Record<string, boolean>;
      },
      {
        hookVar?: boolean;
        execVar?: boolean;
        localDefaultVar?: boolean;
        globalDefaultVar?: boolean;
      }
    > = gql`
      query GetCounter(
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
      link: new ApolloLink(
        (request) =>
          new Observable((observer) => {
            if (request.operationName === "GetCounter") {
              setTimeout(() => {
                observer.next({
                  data: {
                    counter: ++count,
                    vars: request.variables,
                  },
                });
                observer.complete();
              }, 50);
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

    using __disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () => {
          return useLazyQuery(counterQuery, {
            notifyOnNetworkStatusChange: true,
          });
        },
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {
          globalDefaultVar: true,
          localDefaultVar: true,
          hookVar: true,
        },
      });
    }

    const expectedFinalData = {
      counter: 1,
      vars: {
        globalDefaultVar: true,
        localDefaultVar: true,
        hookVar: true,
        execVar: true,
      },
    };

    const [execute] = getCurrentSnapshot();
    const execResult = await execute({
      variables: {
        execVar: true,
      },
    });

    // TODO: Determine if the return value makes sense. Other fetching functions
    // (`refetch`, `fetchMore`, etc.) resolve with an `ApolloQueryResult` type
    // which contain a subset of this data.
    expect(execResult).toEqualLazyQueryResult({
      data: expectedFinalData,
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {
        globalDefaultVar: true,
        localDefaultVar: true,
        hookVar: true,
        execVar: true,
      },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {
          globalDefaultVar: true,
          localDefaultVar: true,
          hookVar: true,
          execVar: true,
        },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: expectedFinalData,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {
          globalDefaultVar: true,
          localDefaultVar: true,
          hookVar: true,
          execVar: true,
        },
      });
    }

    const refetchResult = await getCurrentSnapshot()[1].reobserve({
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-first",
      variables: {
        execVar: false,
      },
    });

    expect(refetchResult).toEqualApolloQueryResult({
      data: { counter: 2, vars: { execVar: false } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: expectedFinalData,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: expectedFinalData,
        variables: { execVar: false },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { counter: 2, vars: { execVar: false } },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: expectedFinalData,
        variables: { execVar: false },
      });
    }

    const execResult2 = await getCurrentSnapshot()[0]({
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      variables: {
        execVar: true,
      },
    });

    expect(execResult2).toEqualLazyQueryResult({
      data: { counter: 3, vars: { ...expectedFinalData.vars, execVar: true } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { counter: 2, vars: { execVar: false } },
      variables: {
        globalDefaultVar: true,
        localDefaultVar: true,
        hookVar: true,
        execVar: true,
      },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { counter: 2, vars: { execVar: false } },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: { counter: 2, vars: { execVar: false } },
        variables: {
          globalDefaultVar: true,
          localDefaultVar: true,
          hookVar: true,
          execVar: true,
        },
      });
    }

    // For some reason we get an extra render in React 18 of the same thing
    if (IS_REACT_18) {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { counter: 2, vars: { execVar: false } },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: { counter: 2, vars: { execVar: false } },
        variables: {
          globalDefaultVar: true,
          localDefaultVar: true,
          hookVar: true,
          execVar: true,
        },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: {
          counter: 3,
          vars: { ...expectedFinalData.vars, execVar: true },
        },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { counter: 2, vars: { execVar: false } },
        variables: {
          globalDefaultVar: true,
          localDefaultVar: true,
          hookVar: true,
          execVar: true,
        },
      });
    }
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
        delay: 20,
      },
      {
        request: { query: query2 },
        result: { data: { name: "changed" } },
        delay: 20,
      },
    ];

    const cache = new InMemoryCache();
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot, rerender } =
      await renderHookToSnapshotStream(({ query }) => useLazyQuery(query), {
        initialProps: { query: query1 },
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks} cache={cache}>
            {children}
          </MockedProvider>
        ),
      });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toEqualLazyQueryResult({
      data: { hello: "world" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }
    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await rerender({ query: query2 });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await expect(execute()).resolves.toEqualLazyQueryResult({
      data: { name: "changed" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { hello: "world" },
      variables: {},
    });

    // TODO: Determine if this additional render makes sense without notifyOnNetworkStatusChange
    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: { hello: "world" },
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { name: "changed" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "world" },
        variables: {},
      });
    }
  });

  it('should fetch data each time the execution function is called, when using a "network-only" fetch policy', async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: "world 1" } },
        delay: 20,
      },
      {
        request: { query: helloQuery },
        result: { data: { hello: "world 2" } },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () =>
          useLazyQuery(helloQuery, {
            fetchPolicy: "network-only",
          }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toEqualLazyQueryResult({
      data: { hello: "world 1" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 1" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await expect(execute()).resolves.toEqualLazyQueryResult({
      data: { hello: "world 2" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { hello: "world 1" },
      variables: {},
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
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

  it("should persist previous data when a query is re-run", async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: "world 1" } },
        delay: 20,
      },
      {
        request: { query: helloQuery },
        result: { data: { hello: "world 2" } },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () =>
          useLazyQuery(helloQuery, {
            notifyOnNetworkStatusChange: true,
          }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toEqualLazyQueryResult({
      data: { hello: "world 1" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 1" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [, { refetch }] = getCurrentSnapshot();

    await expect(refetch()).resolves.toEqualApolloQueryResult({
      data: { hello: "world 2" },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 1" },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.refetch,
        previousData: { hello: "world 1" },
        variables: {},
      });
    }
    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 2" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "world 1" },
        variables: {},
      });
    }
  });

  // TODO: Determine if this hook makes sense for polling or if that should be
  // reserved for useQuery
  it.skip("should allow for the query to start with polling", async () => {
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

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useLazyQuery(helloQuery), {
        wrapper,
      });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await tick();
    getCurrentSnapshot()[1].startPolling(10);

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 1" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 2" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "world 1" },
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 3" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "world 2" },
        variables: {},
      });
    }

    getCurrentSnapshot()[1].stopPolling();

    expect(takeSnapshot).not.toRerender();
  });

  it.skip("should persist previous data when a query is re-run and variable changes", async () => {
    const CAR_QUERY_BY_ID = gql`
      query ($id: Int) {
        car(id: $id) {
          make
          model
        }
      }
    `;

    const data1 = {
      car: {
        make: "Audi",
        model: "A4",
        __typename: "Car",
      },
    };

    const data2 = {
      car: {
        make: "Audi",
        model: "RS8",
        __typename: "Car",
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

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useLazyQuery(CAR_QUERY_BY_ID), {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(
      execute({ variables: { id: 1 } })
    ).resolves.toEqualLazyQueryResult({
      data: data1,
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: 1 },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: data1,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: 1 },
      });
    }

    await expect(
      execute({ variables: { id: 2 } })
    ).resolves.toEqualLazyQueryResult({
      data: data2,
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: data1,
      variables: { id: 2 },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: data1,
        variables: { id: 2 },
      });
    }
    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: data2,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: data1,
        variables: { id: 2 },
      });
    }
  });

  it.skip("should work with cache-and-network fetch policy", async () => {
    const cache = new InMemoryCache();
    const link = mockSingleLink({
      request: { query: helloQuery },
      result: { data: { hello: "from link" } },
      delay: 20,
    });

    const client = new ApolloClient({
      link,
      cache,
    });

    cache.writeQuery({ query: helloQuery, data: { hello: "from cache" } });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () => useLazyQuery(helloQuery, { fetchPolicy: "cache-and-network" }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toEqualLazyQueryResult({
      data: { hello: "from link" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { hello: "from cache" },
      variables: {},
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        // TODO: FIXME
        data: { hello: "from cache" },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "from link" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "from cache" },
        variables: {},
      });
    }
  });

  it.skip("should have matching results from execution function and hook", async () => {
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

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useLazyQuery(query), {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await tick();
    let executeResult = execute({ variables: { filter: "PA" } });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { filter: "PA" },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { countries: { code: "PA", name: "Panama" } },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { filter: "PA" },
      });
    }

    await expect(executeResult).resolves.toEqualLazyQueryResult({
      data: {
        countries: {
          code: "PA",
          name: "Panama",
        },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { filter: "PA" },
    });

    await tick();
    executeResult = execute({ variables: { filter: "BA" } });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: { countries: { code: "PA", name: "Panama" } },
        variables: { filter: "BA" },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { countries: { code: "BA", name: "Bahamas" } },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { countries: { code: "PA", name: "Panama" } },
        variables: { filter: "BA" },
      });
    }

    await expect(executeResult).resolves.toEqualLazyQueryResult({
      data: { countries: { code: "BA", name: "Bahamas" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { countries: { code: "PA", name: "Panama" } },
      variables: { filter: "BA" },
    });
  });

  it.skip("the promise should reject with errors the “way useMutation does”", async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: {
          errors: [{ message: "error 1" }],
        },
        delay: 20,
      },
      {
        request: { query: helloQuery },
        result: {
          errors: [{ message: "error 2" }],
        },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, peekSnapshot } = await renderHookToSnapshotStream(
      () => useLazyQuery(helloQuery),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      }
    );

    const [execute] = await peekSnapshot();

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const executePromise = Promise.resolve().then(() => execute());

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        error: new ApolloError({ graphQLErrors: [{ message: "error 1" }] }),
        variables: {},
      });
    }

    await expect(executePromise).resolves.toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      error: new ApolloError({ graphQLErrors: [{ message: "error 1" }] }),
      variables: {},
    });

    void execute();

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        error: new ApolloError({ graphQLErrors: [{ message: "error 1" }] }),
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        error: new ApolloError({ graphQLErrors: [{ message: "error 2" }] }),
        variables: {},
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it.skip("the promise should not cause an unhandled rejection", async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: {
          errors: [new GraphQLError("error 1")],
        },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, peekSnapshot } = await renderHookToSnapshotStream(
      () => useLazyQuery(helloQuery),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      }
    );

    const [execute] = await peekSnapshot();

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    void execute();

    // Making sure the rejection triggers a test failure.
    await wait(50);
  });

  it.skip("allows in-flight requests to resolve when component unmounts", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({ link, cache: new InMemoryCache() });

    const { result, unmount } = renderHook(() => useLazyQuery(helloQuery), {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    const [execute] = result.current;

    let promise: Promise<QueryResult<{ hello: string }>>;
    act(() => {
      promise = execute();
    });

    unmount();

    link.simulateResult({ result: { data: { hello: "Greetings" } } }, true);

    await expect(promise!).resolves.toEqualLazyQueryResult({
      data: { hello: "Greetings" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  });

  // TODO: Determine if this is something we should handle or not. Disabling for
  // now until we know.
  it.skip("handles resolving multiple in-flight requests when component unmounts", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({ link, cache: new InMemoryCache() });

    const { result, unmount } = renderHook(() => useLazyQuery(helloQuery), {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    const [execute] = result.current;

    let promise1: Promise<QueryResult<{ hello: string }>>;
    let promise2: Promise<QueryResult<{ hello: string }>>;
    act(() => {
      promise1 = execute();
      promise2 = execute();
    });

    unmount();

    link.simulateResult({ result: { data: { hello: "Greetings" } } }, true);

    const expectedResult = {
      data: { hello: "Greetings" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    };

    await expect(promise1!).resolves.toEqualLazyQueryResult(expectedResult);
    await expect(promise2!).resolves.toEqualLazyQueryResult(expectedResult);
  });

  // https://github.com/apollographql/apollo-client/issues/9755
  // TODO: Determine if this is a case we want to handle. Disabling until we
  // know for sure.
  it.skip("resolves each execution of the query with the appropriate result and renders with the result from the latest execution", async () => {
    interface Data {
      user: { id: string; name: string };
    }

    interface Variables {
      id: string;
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
        request: { query, variables: { id: "1" } },
        result: { data: { user: { id: "1", name: "John Doe" } } },
        delay: 20,
      },
      {
        request: { query, variables: { id: "2" } },
        result: { data: { user: { id: "2", name: "Jane Doe" } } },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, peekSnapshot } = await renderHookToSnapshotStream(
      () => useLazyQuery(query),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      }
    );

    const [execute] = await peekSnapshot();

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {} as Variables,
      });
    }

    const promise1 = execute({ variables: { id: "1" } });
    const promise2 = execute({ variables: { id: "2" } });

    await expect(promise1).resolves.toEqualLazyQueryResult({
      data: mocks[0].result.data,
      loading: false,
      called: true,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "2" },
    });

    await expect(promise2).resolves.toEqualLazyQueryResult({
      data: mocks[1].result.data,
      loading: false,
      called: true,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "2" },
    });

    if (IS_REACT_17) {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: "1" },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: undefined,
        variables: { id: "2" },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: mocks[1].result.data,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: "2" },
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  // https://github.com/apollographql/apollo-client/issues/10198
  it.skip("uses the most recent query document when the hook rerenders before execution", async () => {
    const query = gql`
      query DummyQuery {
        shouldNotBeUsed
      }
    `;

    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: "Greetings" } },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot, rerender } =
      await renderHookToSnapshotStream(({ query }) => useLazyQuery(query), {
        initialProps: { query },
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await rerender({ query: helloQuery });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toEqualLazyQueryResult({
      data: { hello: "Greetings" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "Greetings" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }
  });

  it.skip("does not refetch when rerendering after executing query", async () => {
    interface Data {
      user: { id: string; name: string };
    }

    interface Variables {
      id: string;
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
            data: { user: { id: operation.variables.id, name: "John Doe" } },
          });
          observer.complete();
        }, 20);
      });
    });

    const client = new ApolloClient({ link, cache: new InMemoryCache() });

    const { result, rerender } = renderHook(() => useLazyQuery(query), {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    const [execute] = result.current;

    await act(() => execute({ variables: { id: "2" } }));

    expect(fetchCount).toBe(1);

    rerender();

    await wait(10);

    expect(fetchCount).toBe(1);
  });

  // https://github.com/apollographql/apollo-client/issues/9448
  // TODO: Determine how the new behavior changes this test.
  // Proposal: I would expect that calling the execute function again with no
  // variables is the same thing as setting variables back to undefined, so this
  // should be treated the same as changing variables.
  it.skip.each(["network-only", "no-cache", "cache-and-network"] as const)(
    "does not issue multiple network calls when calling execute again without variables with a %s fetch policy",
    async (fetchPolicy) => {
      interface Data {
        user: { id: string | null; name: string };
      }

      interface Variables {
        id?: string;
      }

      const query: TypedDocumentNode<Data, Variables> = gql`
        query UserQuery($id: ID) {
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
          const { id } = operation.variables;

          setTimeout(() => {
            observer.next({
              data: {
                user:
                  id ?
                    { id, name: "John Doe" }
                  : { id: null, name: "John Default" },
              },
            });
            observer.complete();
          }, 20);
        });
      });

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useLazyQuery(query, { fetchPolicy }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await act(() => result.current[0]({ variables: { id: "2" } }));

      expect(fetchCount).toBe(1);

      await waitFor(() => {
        expect(result.current[1]).toEqualLazyQueryResult({
          data: { user: { id: "2", name: "John Doe" } },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: { id: "2" },
        });
      });

      expect(fetchCount).toBe(1);

      await act(() => result.current[0]());

      await waitFor(() => {
        expect(result.current[1]).toEqualLazyQueryResult({
          data: { user: { id: null, name: "John Default" } },
          called: true,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: { user: { id: "2", name: "John Doe" } },
          variables: {},
        });
      });

      expect(fetchCount).toBe(2);
    }
  );

  it.skip("maintains stable execute function when passing in dynamic function options", async () => {
    interface Data {
      user: { id: string; name: string };
    }

    interface Variables {
      id: string;
    }

    const query: TypedDocumentNode<Data, Variables> = gql`
      query UserQuery($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const link = new MockLink([
      {
        request: { query, variables: { id: "1" } },
        result: { data: { user: { id: "1", name: "John Doe" } } },
        delay: 20,
      },
      {
        request: { query, variables: { id: "2" } },
        result: { errors: [new GraphQLError("Oops")] },
        delay: 20,
      },
      {
        request: { query, variables: { id: "3" } },
        result: { data: { user: { id: "3", name: "Johnny Three" } } },
        delay: 20,
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]);

    const client = new ApolloClient({ link, cache: new InMemoryCache() });

    let countRef = { current: 0 };

    const trackClosureValue = jest.fn();

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot, rerender } =
      await renderHookToSnapshotStream(
        () => {
          let count = countRef.current;

          return useLazyQuery(query, {
            fetchPolicy: "cache-first",
            skipPollAttempt: () => {
              trackClosureValue("skipPollAttempt", count);
              return false;
            },
            nextFetchPolicy: (currentFetchPolicy) => {
              trackClosureValue("nextFetchPolicy", count);
              return currentFetchPolicy;
            },
          });
        },
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        // @ts-expect-error Need to fix the return value of this property
        variables: {},
      });
    }

    const [originalExecute] = getCurrentSnapshot();

    countRef.current++;
    // TODO: Update when https://github.com/testing-library/react-render-stream-testing-library/issues/13 is fixed
    await rerender(undefined);

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        // @ts-expect-error Need to fix the return value of this property
        variables: {},
      });
    }

    let [execute] = getCurrentSnapshot();
    expect(execute).toBe(originalExecute);

    await execute({ variables: { id: "1" } });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: { id: "1" },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { user: { id: "1", name: "John Doe" } },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: "1" },
      });
    }

    // after fetch
    expect(trackClosureValue).toHaveBeenNthCalledWith(1, "nextFetchPolicy", 1);
    trackClosureValue.mockClear();

    countRef.current++;

    // TODO: Update when https://github.com/testing-library/react-render-stream-testing-library/issues/13 is fixed
    await rerender(undefined);

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { user: { id: "1", name: "John Doe" } },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: { id: "1" },
      });
    }

    [execute] = getCurrentSnapshot();
    expect(execute).toBe(originalExecute);

    await execute({ variables: { id: "2" } });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: { user: { id: "1", name: "John Doe" } },
        variables: { id: "2" },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: new ApolloError({ graphQLErrors: [{ message: "Oops" }] }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: { user: { id: "1", name: "John Doe" } },
        variables: { id: "2" },
      });
    }

    // variables changed
    expect(trackClosureValue).toHaveBeenNthCalledWith(1, "nextFetchPolicy", 2);
    // after fetch
    expect(trackClosureValue).toHaveBeenNthCalledWith(2, "nextFetchPolicy", 2);
    trackClosureValue.mockClear();

    countRef.current++;
    // TODO: Update when https://github.com/testing-library/react-render-stream-testing-library/issues/13 is fixed
    await rerender(undefined);

    [execute] = getCurrentSnapshot();
    expect(execute).toBe(originalExecute);

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: new ApolloError({ graphQLErrors: [{ message: "Oops" }] }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: { user: { id: "1", name: "John Doe" } },
        variables: { id: "2" },
      });
    }

    await execute({ variables: { id: "3" } });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        previousData: { user: { id: "1", name: "John Doe" } },
        variables: { id: "3" },
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { user: { id: "3", name: "Johnny Three" } },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { user: { id: "1", name: "John Doe" } },
        variables: { id: "3" },
      });
    }

    // variables changed
    expect(trackClosureValue).toHaveBeenNthCalledWith(1, "nextFetchPolicy", 3);
    // after fetch
    expect(trackClosureValue).toHaveBeenNthCalledWith(2, "nextFetchPolicy", 3);
    trackClosureValue.mockClear();

    // Test for stale closures for skipPollAttempt
    getCurrentSnapshot()[1].startPolling(20);
    await wait(50);
    getCurrentSnapshot()[1].stopPolling();

    expect(trackClosureValue).toHaveBeenCalledWith("skipPollAttempt", 3);
  });

  it.skip("maintains stable execute function identity when changing non-callback options", async () => {
    interface Data {
      user: { id: string; name: string };
    }

    interface Variables {
      id: string;
    }

    const query: TypedDocumentNode<Data, Variables> = gql`
      query UserQuery($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const link = new ApolloLink((operation) => {
      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({
            data: { user: { id: operation.variables.id, name: "John Doe" } },
          });
          observer.complete();
        }, 20);
      });
    });

    const client = new ApolloClient({ link, cache: new InMemoryCache() });

    const { result, rerender } = renderHook(
      ({ notifyOnNetworkStatusChange }) =>
        useLazyQuery(query, { notifyOnNetworkStatusChange }),
      {
        initialProps: { notifyOnNetworkStatusChange: false },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const [execute] = result.current;

    rerender({ notifyOnNetworkStatusChange: true });

    expect(result.current[0]).toBe(execute);
  });

  describe("network errors", () => {
    // For errorPolicy:"none", we expect result.error to be defined and
    // result.data to be undefined
    it.skip('handles errorPolicy:"none" appropriately', async () => {
      const networkError = new Error("from the network");

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          (request) =>
            new Observable((observer) => {
              setTimeout(() => {
                observer.error(networkError);
              }, 20);
            })
        ),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useLazyQuery(helloQuery, {
              errorPolicy: "none",
            }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          error: undefined,
          called: false,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      const [execute] = getCurrentSnapshot();

      await expect(execute()).resolves.toEqualLazyQueryResult({
        data: undefined,
        error: new ApolloError({ networkError }),
        // TODO: Remove this when errors is deprecated
        errors: [],
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: {},
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }
      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          error: new ApolloError({ networkError }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }
    });

    // If there was any data to report, errorPolicy:"all" would report both
    // result.data and result.error, but there is no GraphQL data when we
    // encounter a network error, so the test again captures desired behavior.
    it.skip('handles errorPolicy:"all" appropriately', async () => {
      const networkError = new Error("from the network");

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          (request) =>
            new Observable((observer) => {
              setTimeout(() => {
                observer.error(networkError);
              }, 20);
            })
        ),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useLazyQuery(helloQuery, {
              errorPolicy: "all",
            }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          error: undefined,
          called: false,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      const [execute] = getCurrentSnapshot();

      await expect(execute()).resolves.toEqualLazyQueryResult({
        data: undefined,
        error: new ApolloError({ networkError }),
        // TODO: Remove when errors is deprecated
        errors: [],
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: {},
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }
      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          error: new ApolloError({ networkError }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }
    });

    // Technically errorPolicy:"ignore" is supposed to throw away result.error,
    // but in the case of network errors, since there's no actual data to
    // report, it's useful/important that we report result.error anyway.
    it.skip('handles errorPolicy:"ignore" appropriately', async () => {
      const networkError = new Error("from the network");

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          (request) =>
            new Observable((observer) => {
              setTimeout(() => {
                observer.error(networkError);
              }, 20);
            })
        ),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useLazyQuery(helloQuery, {
              errorPolicy: "ignore",
            }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          error: undefined,
          called: false,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      const [execute] = getCurrentSnapshot();

      await expect(execute()).resolves.toEqualLazyQueryResult({
        data: undefined,
        error: new ApolloError({ networkError }),
        // TODO: Remove when errors is deprecated
        errors: [],
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: {},
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          called: true,
          loading: true,
          networkStatus: NetworkStatus.loading,
          previousData: undefined,
          variables: {},
        });
      }
      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          error: new ApolloError({ networkError }),
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }
    });
  });

  // regression for https://github.com/apollographql/apollo-client/issues/11988
  test.skip("calling `clearStore` while a lazy query is running puts the hook into an error state and resolves the promise with an error result", async () => {
    const link = new MockSubscriptionLink();
    let requests = 0;
    link.onSetup(() => requests++);
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useLazyQuery(helloQuery), {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: undefined,
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const execute = getCurrentSnapshot()[0];

    const promise = execute();
    expect(requests).toBe(1);

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    await client.clearStore();

    await expect(promise).resolves.toEqualLazyQueryResult({
      data: undefined,
      error: new ApolloError({
        networkError: new InvariantError(
          "Store reset while query was in flight (not completed in link chain)"
        ),
      }),
      loading: true,
      networkStatus: NetworkStatus.loading,
      called: true,
      previousData: undefined,
      variables: {},
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
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
    }

    link.simulateResult({ result: { data: { hello: "Greetings" } } }, true);
    await expect(takeSnapshot).not.toRerender({ timeout: 50 });
    expect(requests).toBe(1);
  });

  describe("data masking", () => {
    it.skip("masks queries when dataMasking is `true`", async () => {
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
          delay: 10,
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(() => useLazyQuery(query), {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        });

      // initial render
      await takeSnapshot();

      const [execute] = getCurrentSnapshot();
      const result = await execute();

      expect(result).toEqualLazyQueryResult({
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

      // Loading
      await takeSnapshot();

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
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
    });

    it.skip("does not mask queries when dataMasking is `false`", async () => {
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
          delay: 10,
        },
      ];

      const client = new ApolloClient({
        dataMasking: false,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(() => useLazyQuery(query), {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        });

      // initial render
      await takeSnapshot();

      const [execute] = getCurrentSnapshot();
      const result = await execute();

      expect(result).toEqualLazyQueryResult({
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

      // Loading
      await takeSnapshot();

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
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
      }
    });

    it.skip("does not mask queries by default", async () => {
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
          delay: 10,
        },
      ];

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(() => useLazyQuery(query), {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        });

      // initial render
      await takeSnapshot();

      const [execute] = getCurrentSnapshot();
      const result = await execute();

      expect(result).toEqualLazyQueryResult({
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

      // Loading
      await takeSnapshot();

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
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
      }
    });

    it.skip("masks queries updated by the cache", async () => {
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
          delay: 10,
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(() => useLazyQuery(query), {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        });

      // initial render
      await takeSnapshot();

      const [execute] = getCurrentSnapshot();
      await execute();

      // Loading
      await takeSnapshot();

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
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
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
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
            currentUser: { __typename: "User", id: 1, name: "Test User" },
          },
          variables: {},
        });
      }
    });

    it.skip("does not rerender when updating field in named fragment", async () => {
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
          delay: 20,
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(() => useLazyQuery(query), {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        });

      // initial render
      await takeSnapshot();

      const [execute] = getCurrentSnapshot();
      await execute();

      // Loading
      await takeSnapshot();

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
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

      await expect(takeSnapshot).not.toRerender();

      expect(client.readQuery({ query })).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 35,
        },
      });
    });
  });
});

test.todo("throws when calling `refetch` before execute function is called");
test.todo("throws when calling `fetchMore` before execute function is called");
test.todo(
  "throws when calling `subscribeToMore` before execute function is called"
);
test.todo(
  "throws when calling `updateQuery` before execute function is called"
);
test.todo("throws when calling `reobserve` before execute function is called");

test.skip("uses the updated client when executing the function after changing clients", async () => {
  const { query } = setupSimpleCase();

  const client1 = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data: { greeting: "Hello client 1" } },
        delay: 20,
      },
    ]),
  });

  const client2 = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data: { greeting: "Hello client 2" } },
        delay: 20,
      },
    ]),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot, rerender } =
    await renderHookToSnapshotStream(
      ({ client }) => useLazyQuery(query, { client }),
      { initialProps: { client: client1 } }
    );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toEqualLazyQueryResult({
    data: { greeting: "Hello client 1" },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello client 1" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await rerender({ client: client2 });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello client 1" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(execute()).resolves.toEqualLazyQueryResult({
    data: { greeting: "Hello client 2" },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: { greeting: "Hello client 1" },
    variables: {},
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: { greeting: "Hello client 1" },
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello client 2" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { greeting: "Hello client 1" },
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test.skip("responds to cache updates after executing query", async () => {
  const { query } = setupSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data: { greeting: "Hello" } },
        delay: 20,
      },
    ]),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toEqualLazyQueryResult({
    data: { greeting: "Hello" },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello client 1" },
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
      greeting: "Hello (updated)",
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello (updated)" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test.skip("responds to cache updates after changing variables", async () => {
  const { query, mocks } = setupVariablesCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error this should be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(
    execute({ variables: { id: "1" } })
  ).resolves.toEqualLazyQueryResult({
    data: {
      character: { __typename: "Character", id: "1", name: "Spider-Man" },
    },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: { id: "1" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  await expect(
    execute({ variables: { id: "2" } })
  ).resolves.toEqualLazyQueryResult({
    data: {
      character: { __typename: "Character", id: "2", name: "Black Widow" },
    },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      character: { __typename: "Character", id: "1", name: "Spider-Man" },
    },
    variables: { id: "2" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      previousData: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      variables: { id: "2" },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      variables: { id: "2" },
    });
  }

  client.writeQuery({
    query,
    variables: { id: "2" },
    data: {
      character: {
        __typename: "Character",
        id: "2",
        name: "Black Widow (updated)",
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: {
          __typename: "Character",
          id: "2",
          name: "Black Widow (updated)",
        },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
      variables: { id: "2" },
    });
  }

  await expect(takeSnapshot).not.toRerender();

  // Ensure that writing data to a different set of variables does not rerender
  // the hook
  client.writeQuery({
    query,
    variables: { id: "1" },
    data: {
      character: {
        __typename: "Character",
        id: "1",
        name: "Spider-Man (updated)",
      },
    },
  });

  await expect(takeSnapshot).not.toRerender();
});

test.skip("uses cached result when switching to variables already written to the cache", async () => {
  const { query, mocks } = setupVariablesCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  client.writeQuery({
    query,
    variables: { id: "2" },
    data: {
      character: { __typename: "Character", id: "2", name: "Cached Character" },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error this should be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(
    execute({ variables: { id: "1" } })
  ).resolves.toEqualLazyQueryResult({
    data: {
      character: { __typename: "Character", id: "1", name: "Spider-Man" },
    },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: { id: "1" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  await expect(
    execute({ variables: { id: "2" } })
  ).resolves.toEqualLazyQueryResult({
    data: {
      character: {
        __typename: "Character",
        id: "2",
        name: "Cached Character",
      },
    },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      character: { __typename: "Character", id: "1", name: "Spider-Man" },
    },
    variables: { id: "2" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: {
          __typename: "Character",
          id: "2",
          name: "Cached Character",
        },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      variables: { id: "2" },
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test.skip("applies `errorPolicy` on next fetch when it changes between renders", async () => {
  const query: TypedDocumentNode<
    {
      character: { __typename: "Character"; id: string; name: string } | null;
    },
    VariablesCaseVariables
  > = gql`
    query CharacterQuery($id: ID!) {
      character(id: $id) {
        id
        name
      }
    }
  `;

  const mocks = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: {
          character: { __typename: "Character", id: "1", name: "Spider-Man" },
        },
      },
      delay: 20,
    },
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: {
          character: null,
        },
        errors: [new GraphQLError("Could not find character 1")],
      },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot, rerender } =
    await renderHookToSnapshotStream(
      ({ errorPolicy }: { errorPolicy: ErrorPolicy }) =>
        useLazyQuery(query, { errorPolicy }),
      {
        initialProps: { errorPolicy: "none" },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error this should be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(
    execute({ variables: { id: "1" } })
  ).resolves.toEqualLazyQueryResult({
    data: {
      character: { __typename: "Character", id: "1", name: "Spider-Man" },
    },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: { id: "1" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  await rerender({ errorPolicy: "all" });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  const [, { refetch }] = getCurrentSnapshot();
  refetch();

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: null,
      },
      error: new ApolloError({
        graphQLErrors: [{ message: "Could not find character 1" }],
      }),
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      variables: { id: "1" },
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test.skip("applies `context` on next fetch when it changes between renders", async () => {
  const query = gql`
    query {
      context
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      const context = operation.getContext();

      return Observable.of({ data: { context: { source: context.source } } });
    }),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot, rerender } =
    await renderHookToSnapshotStream(
      ({ context }) => useLazyQuery(query, { context }),
      {
        initialProps: { context: { source: "initialHookValue" } },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toEqualLazyQueryResult({
    data: { context: { source: "initialHookValue" } },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { context: { source: "initialHookValue" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await rerender({ context: { source: "rerender" } });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { context: { source: "rerender" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(execute()).resolves.toEqualLazyQueryResult({
    data: { context: { source: "rerender" } },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { context: { source: "rerender" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(
    execute({ context: { source: "execute" } })
  ).resolves.toEqualLazyQueryResult({
    data: { context: { source: "execute" } },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { context: { source: "execute" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test.skip("applies `refetchWritePolicy` on next fetch when it changes between renders", async () => {
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
      delay: 20,
    },
    {
      request: { query, variables: { min: 12, max: 30 } },
      result: { data: { primes: [13, 17, 19, 23, 29] } },
      delay: 10,
    },
    {
      request: { query, variables: { min: 30, max: 50 } },
      result: { data: { primes: [31, 37, 41, 43, 47] } },
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

  const client = new ApolloClient({
    cache,
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot, rerender } =
    await renderHookToSnapshotStream(
      ({ refetchWritePolicy }) => useLazyQuery(query, { refetchWritePolicy }),
      {
        initialProps: { refetchWritePolicy: "merge" as RefetchWritePolicy },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error needs to be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(
    execute({ variables: { min: 0, max: 12 } })
  ).resolves.toEqualLazyQueryResult({
    data: mocks[0].result.data,
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: { min: 0, max: 12 },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: { min: 0, max: 12 },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: mocks[0].result.data,
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { min: 0, max: 12 },
    });
  }

  expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

  const [, { refetch }] = getCurrentSnapshot();

  void refetch({ min: 12, max: 30 });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { min: 12, max: 30 },
    });
  }

  expect(mergeParams).toEqual([
    [undefined, [2, 3, 5, 7, 11]],
    [
      [2, 3, 5, 7, 11],
      [13, 17, 19, 23, 29],
    ],
  ]);

  await rerender({ refetchWritePolicy: "overwrite" });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { min: 12, max: 30 },
    });
  }

  void refetch({ min: 30, max: 50 });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: mocks[2].result.data,
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { min: 30, max: 50 },
    });
  }

  expect(mergeParams).toEqual([
    [undefined, [2, 3, 5, 7, 11]],
    [
      [2, 3, 5, 7, 11],
      [13, 17, 19, 23, 29],
    ],
    [undefined, [31, 37, 41, 43, 47]],
  ]);

  await expect(takeSnapshot).not.toRerender();
});

test.skip("applies `returnPartialData` on next fetch when it changes between renders", async () => {
  const fullQuery = gql`
    query ($id: ID!) {
      character(id: $id) {
        id
        name
      }
    }
  `;

  const partialQuery = gql`
    query ($id: ID!) {
      character(id: $id) {
        id
      }
    }
  `;

  const mocks = [
    {
      request: { query: fullQuery, variables: { id: "1" } },
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strange",
          },
        },
      },
      delay: 20,
    },
    {
      request: { query: fullQuery, variables: { id: "2" } },
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "2",
            name: "Hulk",
          },
        },
      },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  client.writeQuery({
    query: partialQuery,
    data: { character: { __typename: "Character", id: "1" } },
    variables: { id: "1" },
  });

  client.writeQuery({
    query: partialQuery,
    data: { character: { __typename: "Character", id: "2" } },
    variables: { id: "2" },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot, rerender } =
    await renderHookToSnapshotStream(
      ({ returnPartialData }) => useLazyQuery(fullQuery, { returnPartialData }),
      {
        initialProps: { returnPartialData: false },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(
    execute({ variables: { id: "1" } })
  ).resolves.toEqualLazyQueryResult({
    data: {
      character: { __typename: "Character", id: "1", name: "Doctor Strange" },
    },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: { id: "1" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "1", name: "Doctor Strange" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  await rerender({ returnPartialData: true });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "1", name: "Doctor Strange" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  await expect(
    execute({ variables: { id: "2" } })
  ).resolves.toEqualLazyQueryResult({
    data: {
      character: { __typename: "Character", id: "2", name: "Hulk" },
    },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      character: { __typename: "Character", id: "1", name: "Doctor Strange" },
    },
    variables: { id: "2" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { character: { __typename: "Character", id: "2" } },
      called: true,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      previousData: {
        character: { __typename: "Character", id: "1", name: "Doctor Strange" },
      },
      variables: { id: "2" },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { character: { __typename: "Character", id: "2", name: "Hulk" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: {
        character: { __typename: "Character", id: "1", name: "Doctor Strange" },
      },
      variables: { id: "2" },
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test.skip("applies updated `fetchPolicy` on next fetch when it changes between renders", async () => {
  const { query, mocks } = setupVariablesCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  client.writeQuery({
    query,
    data: {
      character: { __typename: "Character", id: "1", name: "Spider-Cache" },
    },
    variables: { id: "1" },
  });

  client.writeQuery({
    query,
    data: {
      character: { __typename: "Character", id: "2", name: "Cached Widow" },
    },
    variables: { id: "2" },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot, rerender } =
    await renderHookToSnapshotStream(
      ({ fetchPolicy }) => useLazyQuery(query, { fetchPolicy }),
      {
        initialProps: { fetchPolicy: "cache-first" as WatchQueryFetchPolicy },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error should be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(
    execute({ variables: { id: "1" } })
  ).resolves.toEqualLazyQueryResult({
    data: {
      character: { __typename: "Character", id: "1", name: "Spider-Cache" },
    },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: { id: "1" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Cache" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  await rerender({ fetchPolicy: "cache-and-network" });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Cache" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: { id: "1" },
    });
  }

  await expect(
    execute({ variables: { id: "2" } })
  ).resolves.toEqualLazyQueryResult({
    data: {
      character: { __typename: "Character", id: "2", name: "Black Widow" },
    },
    called: true,
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      character: { __typename: "Character", id: "2", name: "Cached Widow" },
    },
    variables: { id: "2" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "1", name: "Cached Widow" },
      },
      called: true,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      previousData: {
        character: { __typename: "Character", id: "1", name: "Spider-Cache" },
      },
      variables: { id: "2" },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: {
        character: { __typename: "Character", id: "2", name: "Spider-Cache" },
      },
      variables: { id: "2" },
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

describe.skip("Type Tests", () => {
  test.skip("NoInfer prevents adding arbitrary additional variables", () => {
    const typedNode = {} as TypedDocumentNode<{ foo: string }, { bar: number }>;
    const [execute, { variables }] = useLazyQuery(typedNode);

    void execute({
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

  test.skip("uses masked types when using masked document", async () => {
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

    interface UnmaskedQuery {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      };
    }

    interface Subscription {
      updatedUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    interface UnmaskedSubscription {
      updatedUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      };
    }

    const query: MaskedDocumentNode<Query> = gql``;

    const [
      execute,
      { data, previousData, subscribeToMore, fetchMore, refetch, updateQuery },
    ] = useLazyQuery(query);

    expectTypeOf(data).toEqualTypeOf<Masked<Query> | undefined>();
    expectTypeOf(previousData).toEqualTypeOf<Masked<Query> | undefined>();

    subscribeToMore({
      document: gql`` as TypedDocumentNode<Subscription, never>,
      updateQuery(queryData, { subscriptionData, complete, previousData }) {
        expectTypeOf(queryData).toEqualTypeOf<UnmaskedQuery>();
        expectTypeOf(complete).toEqualTypeOf<boolean>();
        expectTypeOf(previousData).toEqualTypeOf<
          UnmaskedQuery | DeepPartial<UnmaskedQuery> | undefined
        >();

        if (complete) {
          expectTypeOf(previousData).toEqualTypeOf<UnmaskedQuery>();
        } else {
          expectTypeOf(previousData).toEqualTypeOf<
            DeepPartial<UnmaskedQuery> | undefined
          >();
        }
        expectTypeOf(
          subscriptionData.data
        ).toEqualTypeOf<UnmaskedSubscription>();

        return {} as UnmaskedQuery;
      },
    });

    updateQuery((_previousData, { complete, previousData }) => {
      expectTypeOf(_previousData).toEqualTypeOf<UnmaskedQuery>();
      expectTypeOf(complete).toEqualTypeOf<boolean>();
      expectTypeOf(previousData).toEqualTypeOf<
        UnmaskedQuery | DeepPartial<UnmaskedQuery> | undefined
      >();

      return {} as UnmaskedQuery;
    });

    {
      const { data } = await execute();

      expectTypeOf(data).toEqualTypeOf<Masked<Query> | undefined>();
    }

    {
      const { data } = await fetchMore({
        variables: {},
        updateQuery: (queryData, { fetchMoreResult }) => {
          expectTypeOf(queryData).toEqualTypeOf<UnmaskedQuery>();
          expectTypeOf(fetchMoreResult).toEqualTypeOf<UnmaskedQuery>();

          return {} as UnmaskedQuery;
        },
      });

      expectTypeOf(data).toEqualTypeOf<Masked<Query> | undefined>();
    }

    {
      const { data } = await refetch();

      expectTypeOf(data).toEqualTypeOf<Masked<Query> | undefined>();
    }
  });

  test.skip("uses unmodified types when using TypedDocumentNode", async () => {
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

    interface UnmaskedQuery {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      };
    }

    interface Subscription {
      updatedUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    interface UnmaskedSubscription {
      updatedUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      };
    }

    const query: TypedDocumentNode<Query> = gql``;

    const [
      execute,
      { data, previousData, fetchMore, refetch, subscribeToMore, updateQuery },
    ] = useLazyQuery(query);

    expectTypeOf(data).toEqualTypeOf<Query | undefined>();
    expectTypeOf(previousData).toEqualTypeOf<Query | undefined>();

    subscribeToMore({
      document: gql`` as TypedDocumentNode<Subscription, never>,
      updateQuery(queryData, { subscriptionData, complete, previousData }) {
        expectTypeOf(queryData).toEqualTypeOf<UnmaskedQuery>();
        expectTypeOf(previousData).toEqualTypeOf<
          UnmaskedQuery | DeepPartial<UnmaskedQuery> | undefined
        >();
        expectTypeOf(
          subscriptionData.data
        ).toEqualTypeOf<UnmaskedSubscription>();

        if (complete) {
          expectTypeOf(previousData).toEqualTypeOf<UnmaskedQuery>();
        } else {
          expectTypeOf(previousData).toEqualTypeOf<
            DeepPartial<UnmaskedQuery> | undefined
          >();
        }

        return {} as UnmaskedQuery;
      },
    });

    updateQuery((_previousData, { complete, previousData }) => {
      expectTypeOf(_previousData).toEqualTypeOf<UnmaskedQuery>();
      expectTypeOf(complete).toEqualTypeOf<boolean>();
      expectTypeOf(previousData).toEqualTypeOf<
        UnmaskedQuery | DeepPartial<UnmaskedQuery> | undefined
      >();

      if (complete) {
        expectTypeOf(previousData).toEqualTypeOf<UnmaskedQuery>();
      } else {
        expectTypeOf(previousData).toEqualTypeOf<
          DeepPartial<UnmaskedQuery> | undefined
        >();
      }
    });

    {
      const { data } = await execute();

      expectTypeOf(data).toEqualTypeOf<Query | undefined>();
    }

    {
      const { data } = await fetchMore({
        variables: {},
        updateQuery: (queryData, { fetchMoreResult }) => {
          expectTypeOf(queryData).toEqualTypeOf<UnmaskedQuery>();
          expectTypeOf(fetchMoreResult).toEqualTypeOf<UnmaskedQuery>();

          return {} as UnmaskedQuery;
        },
      });

      expectTypeOf(data).toEqualTypeOf<Query | undefined>();
    }

    {
      const { data } = await refetch();

      expectTypeOf(data).toEqualTypeOf<Query | undefined>();
    }
  });
});
