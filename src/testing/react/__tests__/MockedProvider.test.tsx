import { render, screen } from "@testing-library/react";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";
import React from "react";
import type { Observable } from "rxjs";
import { EMPTY } from "rxjs";

import type { TypedDocumentNode } from "@apollo/client";
import { NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { ApolloLink } from "@apollo/client/link";
import { useQuery } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import {
  createMockWrapper,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { MockedProvider } from "@apollo/client/testing/react";

const IS_REACT_17 = React.version.startsWith("17");

const variables = {
  username: "mock_username",
};

const userWithoutTypeName = {
  id: "user_id",
};

const user = {
  __typename: "User",
  ...userWithoutTypeName,
};

const query: TypedDocumentNode<Data, Variables> = gql`
  query GetUser($username: String!) {
    user(username: $username) {
      id
    }
  }
`;

const queryWithTypename: DocumentNode = gql`
  query GetUser($username: String!) {
    user(username: $username) {
      id
      __typename
    }
  }
`;

const mocks: ReadonlyArray<MockLink.MockedResponse> = [
  {
    request: {
      query,
      variables,
    },
    result: { data: { user } },
  },
];

interface Data {
  user: {
    __typename?: string;
    id: string;
  };
}

interface Variables {
  username: string;
}

let errorThrown = false;
const errorLink = new ApolloLink((operation, forward) => {
  let observer: Observable<ApolloLink.Result> | null = EMPTY;
  try {
    observer = forward(operation);
  } catch (error) {
    errorThrown = true;
  }
  return observer;
});

describe("General use", () => {
  beforeEach(() => {
    errorThrown = false;
  });

  it("should mock the data", async () => {
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ mocks }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("should pass the variables to the result function", async () => {
    const mock: MockLink.MockedResponse<Data, Variables> = {
      request: {
        query,
        variables,
      },
      result: jest.fn().mockReturnValue({ data: { user } }),
    };

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ mocks: [mock] }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();

    expect(mock.result).toHaveBeenCalledTimes(1);
    expect(mock.result).toHaveBeenCalledWith(variables);
  });

  it("should pass the variables to the `variables` callback function", async () => {
    const mock: MockLink.MockedResponse<Data, Variables> = {
      request: {
        query,
        variables: jest.fn().mockReturnValue(true),
      },
      result: { data: { user } },
    };

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ mocks: [mock] }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();

    expect(mock.request.variables).toHaveBeenCalledTimes(1);
    expect(mock.request.variables).toHaveBeenCalledWith(variables);
  });

  it("should use the mock if the `variables` callback function returns true", async () => {
    const mock: MockLink.MockedResponse<Data, Variables> = {
      request: {
        query,
        variables: (v) => v.username === variables.username,
      },
      result: { data: { user } },
    };

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ mocks: [mock] }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("should allow querying with the typename", async () => {
    const mocksWithTypename = [
      {
        request: {
          query: queryWithTypename,
          variables,
        },
        result: { data: { user } },
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ mocks: mocksWithTypename }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("should allow using a custom cache", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({
      query,
      variables,
      data: { user },
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ mocks: [], cache }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("should error if the variables in the mock and component do not match", async () => {
    const variables = {
      username: "other_user",
    };

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useQuery(query, { variables }), {
        wrapper: createMockWrapper({ showWarnings: false, mocks }),
      });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: expect.objectContaining({
        message: expect.stringContaining(
          "No more mocked responses for the query"
        ),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
    expect(getCurrentSnapshot().error).toMatchSnapshot();
  });

  it("should error if the `variables` as callback returns false", async () => {
    const mock: MockLink.MockedResponse<Data, Variables> = {
      request: {
        query,
        variables: () => false,
      },
      result: { data: { user } },
    };

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useQuery(query, { variables }), {
        wrapper: createMockWrapper({ showWarnings: false, mocks: [mock] }),
      });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: expect.objectContaining({
        message: expect.stringContaining(
          "No more mocked responses for the query"
        ),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
    expect(getCurrentSnapshot().error).toMatchSnapshot();
  });

  it("should error if the variables do not deep equal", async () => {
    const mocks = [
      {
        request: {
          query,
          variables: {
            age: 13,
            username: "some_user",
          },
        },
        result: { data: { user } },
      },
    ];

    const variables = {
      username: "some_user",
      age: 42,
    };

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useQuery(query, { variables }), {
        wrapper: createMockWrapper({ showWarnings: false, mocks }),
      });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: expect.objectContaining({
        message: expect.stringContaining(
          "No more mocked responses for the query"
        ),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
    expect(getCurrentSnapshot().error).toMatchSnapshot();
  });

  it("should not error if the variables match but have different order", async () => {
    const mocks = [
      {
        request: {
          query,
          variables: {
            age: 13,
            username: "some_user",
          },
        },
        result: { data: { user } },
      },
    ];

    const variables = {
      username: "some_user",
      age: 13,
    };

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ mocks }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("should support mocking a network error", async () => {
    const mocksError = [
      {
        request: {
          query,
          variables,
        },
        error: new Error("something went wrong"),
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ mocks: mocksError }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: new Error("something went wrong"),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("should error if the query in the mock and component do not match", async () => {
    const mocks = [
      {
        request: {
          query: gql`
            query OtherQuery {
              otherQuery {
                id
              }
            }
          `,
          variables,
        },
        result: { data: { user } },
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useQuery(query, { variables }), {
        wrapper: createMockWrapper({ showWarnings: false, mocks }),
      });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: expect.objectContaining({
        message: expect.stringContaining(
          "No more mocked responses for the query"
        ),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
    expect(getCurrentSnapshot().error).toMatchSnapshot();
  });

  it("should pass down props prop in mock as props for the component", () => {
    function Component({ ...variables }) {
      expect(variables.foo).toBe("bar");
      expect(variables.baz).toBe("qux");
      return null;
    }

    render(
      <MockedProvider mocks={mocks} childProps={{ foo: "bar", baz: "qux" }}>
        <Component {...variables} />
      </MockedProvider>
    );
  });

  it("should not crash on unmount if there is no query manager", () => {
    function Component() {
      return null;
    }

    const { unmount } = render(
      <MockedProvider>
        <Component />
      </MockedProvider>
    );

    unmount();
  });

  it("should support returning mocked results from a function", async () => {
    const user = {
      __typename: "User",
      id: 12345,
    };

    const query: DocumentNode = gql`
      query GetUser($username: String!) {
        user(username: $username) {
          id
        }
      }
    `;

    const variables = {
      username: "jsmith",
    };

    const mocks = [
      {
        request: { query, variables },
        result: jest.fn().mockReturnValue({
          data: {
            user: {
              __typename: "User",
              id: 12345,
            },
          },
        }),
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ mocks }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();

    expect(mocks[0].result).toHaveBeenCalledTimes(1);
    expect(mocks[0].result).toHaveBeenCalledWith(variables);
  });

  it('should return "No more mocked responses" errors in response', async () => {
    const link = ApolloLink.from([
      errorLink,
      new MockLink([], { showWarnings: false }),
    ]);

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useQuery(query, { variables }), {
        wrapper: createMockWrapper({ link }),
      });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: expect.objectContaining({
        message: expect.stringContaining(
          "No more mocked responses for the query"
        ),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
    expect(getCurrentSnapshot().error).toMatchSnapshot();

    // The "No more mocked responses" error should not be thrown as an
    // uncaught exception.
    expect(errorThrown).toBeFalsy();
  });

  it("Uses a mock a configured number of times when `maxUsageCount` is configured", async () => {
    const variables = {
      username: "mock_username",
    };

    const mocks: ReadonlyArray<MockLink.MockedResponse> = [
      {
        request: { query, variables },
        maxUsageCount: 2,
        result: { data: { user } },
      },
    ];

    const mockLink = new MockLink(mocks, { showWarnings: false });
    const link = ApolloLink.from([errorLink, mockLink]);

    using _disabledAct = disableActEnvironment();
    const renderStream = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ link }) }
    );
    const { takeSnapshot, getCurrentSnapshot } = renderStream;

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();

    // First refetch (usage count 2)
    await getCurrentSnapshot().refetch();

    await expect(renderStream).toRerenderWithSimilarSnapshot({
      expected: (previous) => ({
        ...previous,
        loading: true,
        networkStatus: NetworkStatus.refetch,
      }),
    });

    await expect(renderStream).toRerenderWithSimilarSnapshot({
      expected: (previous) => ({
        ...previous,
        loading: false,
        networkStatus: NetworkStatus.ready,
      }),
    });

    // Second refetch (exceeds maxUsageCount, should error)
    await getCurrentSnapshot()
      .refetch()
      .catch(() => {});

    if (IS_REACT_17) {
      await expect(renderStream).toRerenderWithSimilarSnapshot({
        expected: (previous) => ({
          ...previous,
          loading: true,
          networkStatus: NetworkStatus.refetch,
        }),
      });
    }

    await expect(renderStream).toRerenderWithSimilarSnapshot({
      expected: (previous) => ({
        ...previous,
        error: expect.objectContaining({
          message: expect.stringContaining("No more mocked responses"),
        }),
        loading: false,
        networkStatus: NetworkStatus.error,
      }),
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("Uses a mock infinite number of times when `maxUsageCount` is configured with Number.POSITIVE_INFINITY", async () => {
    const variables = {
      username: "mock_username",
    };

    const mocks: ReadonlyArray<MockLink.MockedResponse> = [
      {
        request: { query, variables },
        maxUsageCount: Number.POSITIVE_INFINITY,
        result: { data: { user } },
        delay: 0,
      },
    ];

    const mockLink = new MockLink(mocks, { showWarnings: false });
    const link = ApolloLink.from([errorLink, mockLink]);

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () => useQuery(query, { variables: variables }),
        { wrapper: createMockWrapper({ link }) }
      );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: variables,
    });

    await expect(takeSnapshot).not.toRerender();

    // Refetch 100 times - all should succeed
    for (let i = 0; i < 100; i++) {
      await getCurrentSnapshot().refetch();
    }
  });

  it("uses a mock once when `maxUsageCount` is not configured", async () => {
    const variables = { username: "mock_username" };
    const mocks: ReadonlyArray<MockLink.MockedResponse> = [
      {
        request: {
          query,
          variables,
        },
        result: { data: { user } },
      },
    ];

    const mockLink = new MockLink(mocks, { showWarnings: false });
    const link = ApolloLink.from([errorLink, mockLink]);

    using _disabledAct = disableActEnvironment();
    const renderStream = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      { wrapper: createMockWrapper({ link }) }
    );
    const { takeSnapshot, getCurrentSnapshot } = renderStream;

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    await expect(getCurrentSnapshot().refetch()).rejects.toThrow(
      /No more mocked responses/
    );

    if (IS_REACT_17) {
      await expect(renderStream).toRerenderWithSimilarSnapshot({
        expected: (previous) => ({
          ...previous,
          loading: true,
          networkStatus: NetworkStatus.refetch,
        }),
      });
    }

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      error: expect.objectContaining({
        message: expect.stringMatching(/No more mocked responses/),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
    expect(getCurrentSnapshot().error).toMatchSnapshot();
  });

  it("can still use other mocks after a mock has been fully consumed", async () => {
    const variables = { username: "mock_username" };
    const mocks: ReadonlyArray<MockLink.MockedResponse> = [
      {
        request: {
          query,
          variables,
        },
        maxUsageCount: 2,
        result: { data: { user } },
      },
      {
        request: {
          query,
          variables,
        },
        result: {
          data: {
            user: {
              __typename: "User",
              id: "new_id",
            },
          },
        },
      },
    ];

    const mockLink = new MockLink(mocks, { showWarnings: false });
    const link = ApolloLink.from([errorLink, mockLink]);

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useQuery(query, { variables }), {
        wrapper: createMockWrapper({ link }),
      });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    getCurrentSnapshot().refetch();

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: true,
      networkStatus: NetworkStatus.refetch,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables,
    });

    getCurrentSnapshot().refetch();

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: { user },
      dataState: "complete",
      loading: true,
      networkStatus: NetworkStatus.refetch,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: {
        user: {
          __typename: "User",
          id: "new_id",
        },
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { user },
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it('should return "Mocked response should contain" errors in response', async () => {
    const link = ApolloLink.from([
      errorLink,
      new MockLink([
        {
          request: {
            query,
            variables,
          },
        },
      ]),
    ]);

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useQuery(query, { variables }), {
        wrapper: createMockWrapper({ link }),
      });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: expect.objectContaining({
        message: expect.stringMatching(/Mocked response should contain/),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot).not.toRerender();
    expect(getCurrentSnapshot().error).toMatchSnapshot();
    // The "Mocked response should contain" error should not be thrown as an
    // uncaught exception.
    expect(errorThrown).toBeFalsy();
  });

  it("shows a warning in the console when there is no matched mock", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const mocksDifferentQuery = [
      {
        request: {
          query: gql`
            query OtherQuery {
              otherQuery {
                id
              }
            }
          `,
          variables,
        },
        result: { data: { user } },
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      {
        wrapper: createMockWrapper({ mocks: mocksDifferentQuery }),
      }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: expect.objectContaining({
        message: expect.stringMatching(/No more mocked responses/),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("No more mocked responses for the query")
    );

    consoleSpy.mockRestore();
  });

  it("silences console warning for unmatched mocks when `showWarnings` is `false`", async () => {
    using _ = spyOnConsole("warn");
    const mocksDifferentQuery = [
      {
        request: {
          query: gql`
            query OtherQuery {
              otherQuery {
                id
              }
            }
          `,
          variables,
        },
        result: { data: { user } },
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      {
        wrapper: createMockWrapper({
          mocks: mocksDifferentQuery,
          showWarnings: false,
        }),
      }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: expect.objectContaining({
        message: expect.stringMatching(/No more mocked responses/),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  it("silences console warning for unmatched mocks when passing `showWarnings` to `MockLink` directly", async () => {
    using _ = spyOnConsole("warn");
    const mocksDifferentQuery = [
      {
        request: {
          query: gql`
            query OtherQuery {
              otherQuery {
                id
              }
            }
          `,
          variables,
        },
        result: { data: { user } },
      },
    ];

    const link = new MockLink(mocksDifferentQuery, {
      showWarnings: false,
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { variables }),
      {
        wrapper: createMockWrapper({ link }),
      }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables,
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: expect.objectContaining({
        message: expect.stringMatching(/No more mocked responses/),
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      previousData: undefined,
      variables,
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should support loading state testing with delay", async () => {
    jest.useFakeTimers();

    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, { variables });

      if (loading || data === undefined) return <p>Loading the user ID...</p>;

      return <p>The user ID is '{data.user.id}'</p>;
    }

    const mocks: ReadonlyArray<MockLink.MockedResponse> = [
      {
        delay: 30000, // prevent React from batching the loading state away
        request: {
          query,
          variables,
        },
        result: { data: { user } },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <Component {...variables} />
      </MockedProvider>
    );

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    jest.advanceTimersByTime(30_000);

    expect(
      await screen.findByText("The user ID is 'user_id'")
    ).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("should support an infinite loading state with result and delay: Infinity", async () => {
    jest.useFakeTimers();

    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, {
        variables,
      });

      if (loading) return <p>Loading the user ID...</p>;
      if (data === undefined) return <p>Undefined data</p>;

      return <p>The user ID is '{data.user.id}'</p>;
    }

    const mocks: ReadonlyArray<MockLink.MockedResponse> = [
      {
        delay: Infinity, // keep loading forever.
        request: {
          query,
          variables,
        },
        result: { data: { user } },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <Component {...variables} />
      </MockedProvider>
    );

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    jest.advanceTimersByTime(Number.MAX_SAFE_INTEGER);

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    expect(screen.queryByText(/The user ID is/i)).toBeNull();

    jest.useRealTimers();
  });

  it("should support an infinite loading state with error and delay: Infinity", async () => {
    jest.useFakeTimers();

    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, {
        variables,
      });

      if (loading) return <p>Loading the user ID...</p>;
      if (data === undefined) return <p>Undefined data</p>;

      return <p>The user ID is '{data.user.id}'</p>;
    }

    const mocks: ReadonlyArray<MockLink.MockedResponse> = [
      {
        delay: Infinity, // keep loading forever.
        request: {
          query,
          variables,
        },
        error: new Error("something went wrong"),
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <Component {...variables} />
      </MockedProvider>
    );

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    jest.advanceTimersByTime(Number.MAX_SAFE_INTEGER);

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    expect(screen.queryByText(/The user ID is/i)).toBeNull();

    jest.useRealTimers();
  });
});

describe("@client testing", () => {
  it("should support @client fields with a custom cache", async () => {
    const cache = new InMemoryCache();

    cache.writeQuery({
      query: gql`
        {
          networkStatus {
            isOnline
          }
        }
      `,
      data: {
        networkStatus: {
          __typename: "NetworkStatus",
          isOnline: true,
        },
      },
    });

    const clientQuery = gql`
      {
        networkStatus @client {
          isOnline
        }
      }
    `;

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(clientQuery),
      { wrapper: createMockWrapper({ cache }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: {
        networkStatus: {
          __typename: "NetworkStatus",
          isOnline: true,
        },
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  });

  it("should support @client fields with field policies", async () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            networkStatus() {
              return {
                __typename: "NetworkStatus",
                isOnline: true,
              };
            },
          },
        },
      },
    });

    const clientQuery = gql`
      {
        networkStatus @client {
          isOnline
        }
      }
    `;

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(clientQuery),
      { wrapper: createMockWrapper({ cache }) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: {
        networkStatus: {
          __typename: "NetworkStatus",
          isOnline: true,
        },
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  });
});
