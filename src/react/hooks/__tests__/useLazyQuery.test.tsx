import { act, renderHook, screen, waitFor } from "@testing-library/react";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
import { expectTypeOf } from "expect-type";
import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Observable } from "rxjs";

import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  ErrorPolicy,
  InMemoryCache,
  NetworkStatus,
  QueryResult,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from "@apollo/client/core";
import { Masked, MaskedDocumentNode, Unmasked } from "@apollo/client/masking";
import { ApolloProvider } from "@apollo/client/react";
import { useLazyQuery } from "@apollo/client/react/hooks";
import {
  MockLink,
  mockSingleLink,
  MockSubscriptionLink,
  wait,
} from "@apollo/client/testing";
import {
  renderAsync,
  setupSimpleCase,
  setupVariablesCase,
  spyOnConsole,
  VariablesCaseVariables,
} from "@apollo/client/testing/internal";
import { MockedProvider } from "@apollo/client/testing/react";
import { DeepPartial } from "@apollo/client/utilities";
import { InvariantError } from "@apollo/client/utilities/invariant";

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

    expect(result).toEqualStrictTyped({
      data: { hello: "world" },
    });

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

    await expect(takeSnapshot).not.toRerender();
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

    expect(result).toEqualStrictTyped({
      data: { hello: "world 1" },
    });

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

    await expect(takeSnapshot).not.toRerender();
  });

  test("sets initial loading state when notifyOnNetworkStatusChange is true", async () => {
    const mocks = [
      {
        request: { query: helloQuery },
        result: { data: { hello: "world" } },
        delay: 50,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () => useLazyQuery(helloQuery, { notifyOnNetworkStatusChange: true }),
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
    const result = await execute();

    expect(result).toEqualStrictTyped({
      data: { hello: "world" },
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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "world" },
    });

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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { name: "changed" },
    });

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

    await expect(takeSnapshot).not.toRerender();
  });

  it("applies changed query to next refetch after execute", async () => {
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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "world" },
    });

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

    const [, { refetch }] = getCurrentSnapshot();

    await expect(refetch()).resolves.toEqualStrictTyped({
      data: { name: "changed" },
    });

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

    await expect(takeSnapshot).not.toRerender();
  });

  test("renders loading states when changing queries with notifyOnNetworkStatusChange", async () => {
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
      await renderHookToSnapshotStream(
        ({ query }) =>
          useLazyQuery(query, { notifyOnNetworkStatusChange: true }),
        {
          initialProps: { query: query1 },
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks} cache={cache}>
              {children}
            </MockedProvider>
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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "world" },
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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { name: "changed" },
    });

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

    await expect(takeSnapshot).not.toRerender();
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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "world 1" },
    });

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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "world 2" },
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

  it('renders loading states each time the execution function is called when using a "network-only" fetch policy with notifyOnNetworkStatusChange', async () => {
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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "world 1" },
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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "world 2" },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 1" },
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

  it("should persist previous data when a query is refetched", async () => {
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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "world 1" },
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

    await expect(refetch()).resolves.toEqualStrictTyped({
      data: { hello: "world 2" },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "world 1" },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.refetch,
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

    await expect(takeSnapshot).not.toRerender();
  });

  // TODO: Determine if this hook makes sense for polling or if that should be
  // reserved for useQuery. At the very least, we need to figure out if you can
  // start polling a query before it has been executed
  it("should allow for the query to start with polling", async () => {
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
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "world 1" },
    });

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

    getCurrentSnapshot()[1].startPolling(10);

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

    await expect(takeSnapshot).not.toRerender();
  });

  it("should persist previous data when a query is re-run and variable changes", async () => {
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
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute({ variables: { id: 1 } })).resolves.toEqualStrictTyped(
      { data: data1 }
    );

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

    await expect(execute({ variables: { id: 2 } })).resolves.toEqualStrictTyped(
      { data: data2 }
    );

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

    await expect(takeSnapshot).not.toRerender();
  });

  test("renders loading states when a query is re-run and variables changes with notifyOnNetworkStatusChange", async () => {
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
      await renderHookToSnapshotStream(
        () =>
          useLazyQuery(CAR_QUERY_BY_ID, { notifyOnNetworkStatusChange: true }),
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

    await expect(execute({ variables: { id: 1 } })).resolves.toEqualStrictTyped(
      { data: data1 }
    );

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

    await expect(execute({ variables: { id: 2 } })).resolves.toEqualStrictTyped(
      { data: data2 }
    );

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

    await expect(takeSnapshot).not.toRerender();
  });

  it("should work with cache-and-network fetch policy", async () => {
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
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "from link" },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
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

    await expect(takeSnapshot).not.toRerender();
  });

  test("executes on the network multiple times with a cache-and-network fetch policy", async () => {
    const cache = new InMemoryCache();
    const link = new MockLink([
      {
        request: { query: helloQuery },
        result: { data: { hello: "from link" } },
        delay: 20,
      },
      {
        request: { query: helloQuery },
        result: { data: { hello: "from link 2" } },
        delay: 20,
      },
    ]);

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
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "from link" },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
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

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "from link 2" },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "from link" },
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: { hello: "from cache" },
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { hello: "from link 2" },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: { hello: "from link" },
        variables: {},
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  test("executes on the network multiple times with a cache-and-network fetch policy when changing variables", async () => {
    const { query, mocks } = setupVariablesCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    client.writeQuery({
      query,
      data: {
        character: { __typename: "Character", id: "1", name: "Cache 1" },
      },
      variables: { id: "1" },
    });

    client.writeQuery({
      query,
      data: {
        character: { __typename: "Character", id: "2", name: "Cache 2" },
      },
      variables: { id: "2" },
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () => useLazyQuery(query, { fetchPolicy: "cache-and-network" }),
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
    ).resolves.toEqualStrictTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: {
          character: { __typename: "Character", id: "1", name: "Cache 1" },
        },
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
        previousData: {
          character: { __typename: "Character", id: "1", name: "Cache 1" },
        },
        variables: { id: "1" },
      });
    }

    await expect(
      execute({ variables: { id: "2" } })
    ).resolves.toEqualStrictTyped({
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: {
          character: { __typename: "Character", id: "2", name: "Cache 2" },
        },
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
          character: { __typename: "Character", id: "2", name: "Cache 2" },
        },
        variables: { id: "2" },
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  test("renders loading states with a cache-and-network fetch policy when changing variables with notifyOnNetworkStatusChange", async () => {
    const { query, mocks } = setupVariablesCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    client.writeQuery({
      query,
      data: {
        character: { __typename: "Character", id: "1", name: "Cache 1" },
      },
      variables: { id: "1" },
    });

    client.writeQuery({
      query,
      data: {
        character: { __typename: "Character", id: "2", name: "Cache 2" },
      },
      variables: { id: "2" },
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () =>
          useLazyQuery(query, {
            fetchPolicy: "cache-and-network",
            notifyOnNetworkStatusChange: true,
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
    ).resolves.toEqualStrictTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: {
          character: { __typename: "Character", id: "1", name: "Cache 1" },
        },
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
        previousData: {
          character: { __typename: "Character", id: "1", name: "Cache 1" },
        },
        variables: { id: "1" },
      });
    }

    await expect(
      execute({ variables: { id: "2" } })
    ).resolves.toEqualStrictTyped({
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: {
          character: { __typename: "Character", id: "2", name: "Cache 2" },
        },
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
          character: { __typename: "Character", id: "2", name: "Cache 2" },
        },
        variables: { id: "2" },
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it("the promise returned from execute rejects when GraphQL errors are returned and errorPolicy is `none`", async () => {
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
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await expect(execute()).rejects.toEqual(
      new CombinedGraphQLErrors({ errors: [{ message: "error 1" }] })
    );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        error: new CombinedGraphQLErrors({ errors: [{ message: "error 1" }] }),
        variables: {},
      });
    }

    await expect(execute()).rejects.toEqual(
      new CombinedGraphQLErrors({ errors: [{ message: "error 2" }] })
    );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        error: new CombinedGraphQLErrors({ errors: [{ message: "error 2" }] }),
        variables: {},
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it("the promise returned from execute resolves when GraphQL errors are returned and errorPolicy is `all`", async () => {
    const query: TypedDocumentNode<{
      currentUser: { __typename: "User"; id: string } | null;
    }> = gql`
      query currentUser {
        id
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: { currentUser: null },
          errors: [{ message: "Not logged in" }],
        },
        delay: 20,
      },
      {
        request: { query },
        result: {
          data: { currentUser: null },
          errors: [{ message: "Not logged in 2" }],
        },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, peekSnapshot } = await renderHookToSnapshotStream(
      () => useLazyQuery(query, { errorPolicy: "all" }),
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
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { currentUser: null },
      error: new CombinedGraphQLErrors({
        data: { currentUser: null },
        errors: [{ message: "Not logged in" }],
      }),
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { currentUser: null },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        error: new CombinedGraphQLErrors({
          data: { currentUser: null },
          errors: [{ message: "Not logged in" }],
        }),
        variables: {},
      });
    }

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { currentUser: null },
      error: new CombinedGraphQLErrors({
        data: { currentUser: null },
        errors: [{ message: "Not logged in 2" }],
      }),
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { currentUser: null },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        error: new CombinedGraphQLErrors({
          data: { currentUser: null },
          errors: [{ message: "Not logged in 2" }],
        }),
        variables: {},
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it("the promise returned from execute resolves when GraphQL errors are returned and errorPolicy is `ignore`", async () => {
    const query: TypedDocumentNode<{
      currentUser: { __typename: "User"; id: string } | null;
    }> = gql`
      query currentUser {
        id
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: { currentUser: null },
          errors: [{ message: "Not logged in" }],
        },
        delay: 20,
      },
      {
        request: { query },
        result: {
          data: { currentUser: null },
          errors: [{ message: "Not logged in 2" }],
        },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, peekSnapshot } = await renderHookToSnapshotStream(
      () => useLazyQuery(query, { errorPolicy: "ignore" }),
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
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { currentUser: null },
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { currentUser: null },
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { currentUser: null },
    });

    // We don't see an extra render here since the result is deeply equal to the
    // previous result.
    await expect(takeSnapshot).not.toRerender();
  });

  it("allows in-flight requests to resolve when component unmounts", async () => {
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

    await expect(promise!).resolves.toEqualStrictTyped({
      data: { hello: "Greetings" },
    });
  });

  it("handles resolving multiple in-flight requests when component unmounts", async () => {
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

    const expectedResult: QueryResult<{ hello: string }> = {
      data: { hello: "Greetings" },
    };

    await expect(promise1!).resolves.toEqualStrictTyped(expectedResult);
    await expect(promise2!).resolves.toEqualStrictTyped(expectedResult);
  });

  // https://github.com/apollographql/apollo-client/issues/9755
  it("resolves each execution of the query with the appropriate result and renders with the result from the latest execution", async () => {
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
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {} as Variables,
      });
    }

    const promise1 = execute({ variables: { id: "1" } });
    const promise2 = execute({ variables: { id: "2" } });

    await expect(promise1).resolves.toEqualStrictTyped({
      data: mocks[0].result.data,
    });

    await expect(promise2).resolves.toEqualStrictTyped({
      data: mocks[1].result.data,
    });

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
  it("uses the most recent query document when the hook rerenders before execution", async () => {
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
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }

    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toEqualStrictTyped({
      data: { hello: "Greetings" },
    });

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

    await expect(takeSnapshot).not.toRerender();
  });

  it("does not refetch when rerendering after executing query", async () => {
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
  it.each(["network-only", "no-cache", "cache-and-network"] as const)(
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

  it("maintains stable execute function when passing in dynamic function options", async () => {
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
        result: { errors: [{ message: "Oops" }] },
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

    await expect(execute({ variables: { id: "2" } })).rejects.toEqual(
      new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] })
    );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: { user: { id: "1", name: "John Doe" } },
        error: new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
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
        data: { user: { id: "1", name: "John Doe" } },
        error: new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] }),
        called: true,
        loading: false,
        networkStatus: NetworkStatus.error,
        previousData: undefined,
        variables: { id: "2" },
      });
    }

    await execute({ variables: { id: "3" } });

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

  it("maintains stable execute function identity when changing non-callback options", async () => {
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
    it('handles errorPolicy:"none" appropriately', async () => {
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
          called: false,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      const [execute] = getCurrentSnapshot();

      await expect(execute()).rejects.toEqual(networkError);

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          error: networkError,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it('handles errorPolicy:"all" appropriately', async () => {
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
          called: false,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      const [execute] = getCurrentSnapshot();

      await expect(execute()).resolves.toEqualStrictTyped({
        data: undefined,
        error: networkError,
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
          error: networkError,
          called: true,
          loading: false,
          networkStatus: NetworkStatus.error,
          previousData: undefined,
          variables: {},
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it('handles errorPolicy:"ignore" appropriately', async () => {
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
          called: false,
          loading: false,
          networkStatus: NetworkStatus.ready,
          previousData: undefined,
          variables: {},
        });
      }

      const [execute] = getCurrentSnapshot();

      await expect(execute()).resolves.toEqualStrictTyped({ data: undefined });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualLazyQueryResult({
          data: undefined,
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

  // regression for https://github.com/apollographql/apollo-client/issues/11988
  test("calling `clearStore` while a lazy query is running puts the hook into an error state and resolves the promise with an error result", async () => {
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

    await client.clearStore();

    await expect(promise).rejects.toEqual(
      new InvariantError(
        "Store reset while query was in flight (not completed in link chain)"
      )
    );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualLazyQueryResult({
        data: undefined,
        error: new InvariantError(
          "Store reset while query was in flight (not completed in link chain)"
        ),
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

      expect(result).toEqualStrictTyped({
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
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

      await expect(takeSnapshot).not.toRerender();
    });

    it("does not mask queries when dataMasking is `false`", async () => {
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

      expect(result).toEqualStrictTyped({
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
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

      await expect(takeSnapshot).not.toRerender();
    });

    it("does not mask queries by default", async () => {
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

      expect(result).toEqualStrictTyped({
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
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

      await expect(takeSnapshot).not.toRerender();
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

      await expect(takeSnapshot).not.toRerender();
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

test("throws when calling `refetch` before execute function is called", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [, { refetch }] = await takeSnapshot();

  expect(() => {
    void refetch();
  }).toThrow(
    new InvariantError(
      "useLazyQuery: 'refetch' cannot be called before executing the query."
    )
  );
});

test("throws when calling `fetchMore` before execute function is called", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [, { fetchMore }] = await takeSnapshot();

  expect(() => {
    void fetchMore({});
  }).toThrow(
    new InvariantError(
      "useLazyQuery: 'fetchMore' cannot be called before executing the query."
    )
  );
});

test("throws when calling `subscribeToMore` before execute function is called", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [, { subscribeToMore }] = await takeSnapshot();

  expect(() => {
    subscribeToMore({
      document: gql`
        subscription {
          foo
        }
      `,
    });
  }).toThrow(
    new InvariantError(
      "useLazyQuery: 'subscribeToMore' cannot be called before executing the query."
    )
  );
});

test("throws when calling `updateQuery` before execute function is called", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [, { updateQuery }] = await takeSnapshot();

  expect(() => {
    updateQuery(() => ({ greeting: "foo" }));
  }).toThrow(
    new InvariantError(
      "useLazyQuery: 'updateQuery' cannot be called before executing the query."
    )
  );
});

test("throws when calling `startPolling` before execute function is called", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [, { startPolling }] = await takeSnapshot();

  expect(() => {
    startPolling(10);
  }).toThrow(
    new InvariantError(
      "useLazyQuery: 'startPolling' cannot be called before executing the query."
    )
  );
});

test("throws when calling `stopPolling` before execute function is called", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [, { stopPolling }] = await takeSnapshot();

  expect(() => {
    stopPolling();
  }).toThrow(
    new InvariantError(
      "useLazyQuery: 'stopPolling' cannot be called before executing the query."
    )
  );
});

test("throws when calling execute function during first render", async () => {
  using _consoleSpy = spyOnConsole("error");
  const { query, mocks } = setupSimpleCase();

  function App() {
    const [execute] = useLazyQuery(query);

    void execute();

    return null;
  }

  // We need to use the `async` function here to prevent console errors from
  // showing up
  await expect(async () =>
    renderAsync(<App />, {
      wrapper: ({ children }) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      ),
    })
  ).rejects.toThrow(
    new InvariantError(
      "useLazyQuery: 'execute' should not be called during render. To start a query during render, use the 'useQuery' hook."
    )
  );
});

test("throws when calling execute function during subsequent render", async () => {
  using _consoleSpy = spyOnConsole("error");
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();

  function App() {
    const [count, setCount] = React.useState(0);
    const [execute] = useLazyQuery(query);

    if (count === 1) {
      void execute();
    }

    return <button onClick={() => setCount(1)}>Load</button>;
  }

  let error!: Error;

  await renderAsync(<App />, {
    wrapper: ({ children }) => (
      <ErrorBoundary onError={(e) => (error = e)} fallback={<div>Oops</div>}>
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      </ErrorBoundary>
    ),
  });

  await act(() => user.click(screen.getByText("Load")));

  expect(error).toEqual(
    new InvariantError(
      "useLazyQuery: 'execute' should not be called during render. To start a query during render, use the 'useQuery' hook."
    )
  );
});

test("uses the updated client when executing the function after changing clients", async () => {
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
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toEqualStrictTyped({
    data: { greeting: "Hello client 1" },
  });

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

  await expect(execute()).resolves.toEqualStrictTyped({
    data: { greeting: "Hello client 2" },
  });

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

test("responds to cache updates after executing query", async () => {
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
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toEqualStrictTyped({
    data: { greeting: "Hello" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello" },
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
      previousData: {
        greeting: "Hello",
      },
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("responds to cache updates after changing variables", async () => {
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
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error this should be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute({ variables: { id: "1" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
    }
  );

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

  await expect(execute({ variables: { id: "2" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
    }
  );

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

test("uses cached result when switching to variables already written to the cache", async () => {
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
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error this should be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute({ variables: { id: "1" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
    }
  );

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

  await expect(execute({ variables: { id: "2" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: {
          __typename: "Character",
          id: "2",
          name: "Cached Character",
        },
      },
    }
  );

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

test("renders loading states where necessary when switching to variables maybe written to the cache with notifyOnNetworkStatusChange", async () => {
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
    () => useLazyQuery(query, { notifyOnNetworkStatusChange: true }),
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
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error this should be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute({ variables: { id: "1" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
    }
  );

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

  await expect(execute({ variables: { id: "2" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: {
          __typename: "Character",
          id: "2",
          name: "Cached Character",
        },
      },
    }
  );

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

  await expect(execute({ variables: { id: "3" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: {
          __typename: "Character",
          id: "3",
          name: "Iron Man",
        },
      },
    }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: undefined,
      called: true,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      previousData: {
        character: {
          __typename: "Character",
          id: "2",
          name: "Cached Character",
        },
      },
      variables: { id: "3" },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: {
          __typename: "Character",
          id: "3",
          name: "Iron Man",
        },
      },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: {
        character: {
          __typename: "Character",
          id: "2",
          name: "Cached Character",
        },
      },
      variables: { id: "3" },
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("applies `errorPolicy` on next fetch when it changes between renders", async () => {
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
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error this should be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute({ variables: { id: "1" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
    }
  );

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
  void refetch();

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: null,
      },
      error: new CombinedGraphQLErrors({
        data: { character: null },
        errors: [{ message: "Could not find character 1" }],
      }),
      called: true,
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      variables: { id: "1" },
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("applies `context` on next fetch when it changes between renders", async () => {
  const query = gql`
    query {
      context
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      const context = operation.getContext();

      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({ data: { context: { source: context.source } } });
          observer.complete();
        }, 20);
      });
    }),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot, rerender } =
    await renderHookToSnapshotStream(
      ({ context }) =>
        useLazyQuery(query, { context, fetchPolicy: "network-only" }),
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
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toEqualStrictTyped({
    data: { context: { source: "initialHookValue" } },
  });

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
      data: { context: { source: "initialHookValue" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(execute()).resolves.toEqualStrictTyped({
    data: { context: { source: "rerender" } },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { context: { source: "rerender" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { context: { source: "initialHookValue" } },
      variables: {},
    });
  }

  await rerender({ context: { source: "rerenderForRefetch" } });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { context: { source: "rerender" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { context: { source: "initialHookValue" } },
      variables: {},
    });
  }

  // Ensure context isn't just applied to execute function
  void getCurrentSnapshot()[1].refetch();

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { context: { source: "rerenderForRefetch" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { context: { source: "rerender" } },
      variables: {},
    });
  }

  await expect(
    execute({ context: { source: "execute" } })
  ).resolves.toEqualStrictTyped({
    data: { context: { source: "execute" } },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { context: { source: "execute" } },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { context: { source: "rerenderForRefetch" } },
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("applies `refetchWritePolicy` on next fetch when it changes between renders", async () => {
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
  ).resolves.toEqualStrictTyped({ data: mocks[0].result.data });

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
      previousData: mocks[0].result.data,
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
      previousData: mocks[0].result.data,
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
      previousData: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
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

test("applies `returnPartialData` on next fetch when it changes between renders", async () => {
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
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute({ variables: { id: "1" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: { __typename: "Character", id: "1", name: "Doctor Strange" },
      },
    }
  );

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

  await expect(execute({ variables: { id: "2" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: { __typename: "Character", id: "2", name: "Hulk" },
      },
    }
  );

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
        character: { __typename: "Character", id: "2" },
      },
      variables: { id: "2" },
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("applies updated `fetchPolicy` on next fetch when it changes between renders", async () => {
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
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      // @ts-expect-error should be undefined
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute({ variables: { id: "1" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Cache" },
      },
    }
  );

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

  await expect(execute({ variables: { id: "2" } })).resolves.toEqualStrictTyped(
    {
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
    }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: {
        character: { __typename: "Character", id: "2", name: "Cached Widow" },
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
        character: { __typename: "Character", id: "2", name: "Cached Widow" },
      },
      variables: { id: "2" },
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("renders loading states at appropriate times on next fetch after updating `notifyOnNetworkStatusChange`", async () => {
  const { query } = setupSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      { request: { query }, result: { data: { greeting: "Hello 1" } } },
      { request: { query }, result: { data: { greeting: "Hello 2" } } },
      { request: { query }, result: { data: { greeting: "Hello 3" } } },
    ]),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot, rerender } =
    await renderHookToSnapshotStream(
      ({ notifyOnNetworkStatusChange }) =>
        useLazyQuery(query, {
          notifyOnNetworkStatusChange,
          fetchPolicy: "network-only",
        }),
      {
        initialProps: { notifyOnNetworkStatusChange: false },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
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

  await expect(execute()).resolves.toEqualStrictTyped({
    data: { greeting: "Hello 1" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello 1" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await rerender({ notifyOnNetworkStatusChange: true });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello 1" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(execute()).resolves.toEqualStrictTyped({
    data: { greeting: "Hello 2" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello 1" },
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
      data: { greeting: "Hello 2" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { greeting: "Hello 1" },
      variables: {},
    });
  }

  await rerender({ notifyOnNetworkStatusChange: false });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello 2" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { greeting: "Hello 1" },
      variables: {},
    });
  }

  await expect(execute()).resolves.toEqualStrictTyped({
    data: { greeting: "Hello 3" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toEqualLazyQueryResult({
      data: { greeting: "Hello 3" },
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { greeting: "Hello 2" },
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

describe.skip("Type Tests", () => {
  test("NoInfer prevents adding arbitrary additional variables", () => {
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

  test("uses masked types when using masked document", async () => {
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

  test("uses unmodified types when using TypedDocumentNode", async () => {
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

  test("variables are optional and can be anything with an DocumentNode", () => {
    const query = gql``;

    const [execute] = useLazyQuery(query);

    void execute();
    void execute({});
    void execute({ variables: {} });
    void execute({ variables: { foo: "bar" } });
    void execute({ variables: { bar: "baz" } });
  });

  test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
    const query: TypedDocumentNode<{ greeting: string }> = gql``;

    const [execute] = useLazyQuery(query);

    void execute();
    void execute({});
    void execute({ variables: {} });
    void execute({ variables: { foo: "bar" } });
    void execute({ variables: { bar: "baz" } });
  });

  test("variables are optional when TVariables are empty", () => {
    const query: TypedDocumentNode<
      { greeting: string },
      Record<string, never>
    > = gql``;

    const [execute] = useLazyQuery(query);

    void execute();
    void execute({});
    void execute({ variables: {} });
    // @ts-expect-error unknown variables
    void execute({ variables: { foo: "bar" } });
  });

  test("does not allow variables when TVariables is `never`", () => {
    const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

    const [execute] = useLazyQuery(query);

    void execute();
    void execute({});
    void execute({ variables: {} });
    // @ts-expect-error unknown variables
    void execute({ variables: { foo: "bar" } });
  });

  test("optional variables are optional", () => {
    const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
      gql``;

    const [execute] = useLazyQuery(query);

    void execute();
    void execute({});
    void execute({ variables: {} });
    void execute({ variables: { limit: 10 } });
    void execute({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void execute({
      variables: {
        limit: 10,
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
  });

  test("enforces required variables when TVariables includes required variables", () => {
    const query: TypedDocumentNode<{ character: string }, { id: string }> =
      gql``;

    const [execute] = useLazyQuery(query);

    // @ts-expect-error empty variables
    void execute();
    // @ts-expect-error empty variables
    void execute({});
    // @ts-expect-error empty variables
    void execute({ variables: {} });
    void execute({ variables: { id: "1" } });
    void execute({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void execute({
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
  });

  test("requires variables with mixed TVariables", () => {
    const query: TypedDocumentNode<
      { character: string },
      { id: string; language?: string }
    > = gql``;

    const [execute] = useLazyQuery(query);

    // @ts-expect-error empty variables
    void execute();
    // @ts-expect-error empty variables
    void execute({});
    // @ts-expect-error empty variables
    void execute({ variables: {} });
    void execute({ variables: { id: "1" } });
    void execute({
      // @ts-expect-error missing required variables
      variables: { language: "en" },
    });
    void execute({ variables: { id: "1", language: "en" } });
    void execute({
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void execute({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
  });
});
