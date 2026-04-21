import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { from } from "rxjs";

import type {
  DataState,
  ErrorLike,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";
import type { QueryRef } from "@apollo/client/react";
import { useBackgroundQuery, useReadQuery } from "@apollo/client/react";
import {
  asyncIterableSubject,
  createClientWrapper,
  executeSchemaGraphQL17Alpha9,
  friendListSchemaGraphQL17Alpha9,
  markAsStreaming,
  spyOnConsole,
} from "@apollo/client/testing/internal";

async function renderSuspenseHook<
  TData,
  TVariables extends OperationVariables,
  TQueryRef extends QueryRef<any, any, any>,
  TStates extends DataState<TData>["dataState"] = TQueryRef extends (
    QueryRef<any, any, infer States>
  ) ?
    States
  : never,
  Props = never,
>(
  renderHook: (
    props: Props extends never ? undefined : Props
  ) => [TQueryRef, useBackgroundQuery.Result<TData, TVariables>],
  options: Pick<RenderOptions, "wrapper"> & { initialProps?: Props }
) {
  function UseReadQuery({ queryRef }: { queryRef: QueryRef }) {
    useTrackRenders({ name: "useReadQuery" });
    replaceSnapshot(useReadQuery(queryRef) as any);

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "SuspenseFallback" });

    return null;
  }

  function ErrorFallback() {
    useTrackRenders({ name: "ErrorBoundary" });

    return null;
  }

  function App({ props }: { props: Props | undefined }) {
    useTrackRenders({ name: "useBackgroundQuery" });
    const [queryRef] = renderHook(props as any);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => replaceSnapshot({ error })}
        >
          <UseReadQuery queryRef={queryRef} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  const { render, takeRender, replaceSnapshot } = createRenderStream<
    useReadQuery.Result<TData, TStates> | { error: ErrorLike }
  >();

  const utils = await render(<App props={options.initialProps} />, options);

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  return { takeRender, rerender };
}

function createLink(rootValue?: unknown) {
  return new ApolloLink((operation) => {
    return from(
      executeSchemaGraphQL17Alpha9(
        friendListSchemaGraphQL17Alpha9,
        operation.query,
        rootValue
      )
    );
  });
}

const friends = [
  { name: "Luke", id: 1 },
  { name: "Han", id: 2 },
  { name: "Leia", id: 3 },
];

test('does not suspend deferred queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
  const { stream, subject } = asyncIterableSubject();
  interface Data {
    friendList: Array<{ __typename: "Friend"; id: string; name: string }>;
  }

  const query: TypedDocumentNode<Data> = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          friendList: {
            merge: (_, incoming) => {
              return incoming;
            },
          },
        },
      },
    },
  });
  cache.writeQuery({
    query,
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Cached Luke" },
        { __typename: "Friend", id: "2", name: "Cached Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    },
  });
  const client = new ApolloClient({
    cache,
    link: createLink({ friendList: () => stream }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useBackgroundQuery(query, { fetchPolicy: "cache-and-network" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "useReadQuery",
    ]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Cached Luke" },
          { __typename: "Friend", id: "2", name: "Cached Han" },
          { __typename: "Friend", id: "3", name: "Cached Leia" },
        ],
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      },
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
    });
  }

  subject.next(friends[1]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
        ],
      },
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
    });
  }

  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      }),
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
    });
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});

test('does not suspend deferred queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
  const { stream, subject } = asyncIterableSubject();
  interface QueryData {
    friendList: Array<{ __typename: "Friend"; id: string; name: string }>;
  }

  const query: TypedDocumentNode<QueryData> = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    link: createLink({ friendList: () => stream }),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            friendList: {
              merge: (_, incoming) => {
                return incoming;
              },
            },
          },
        },
      },
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  // We are intentionally writing partial data to the cache. Supress console
  // warnings to avoid unnecessary noise in the test.
  {
    using _consoleSpy = spyOnConsole("error");
    client.writeQuery({
      query,
      data: {
        friendList: [
          // @ts-expect-error
          { __typename: "Friend", id: "1" },
          // @ts-expect-error
          { __typename: "Friend", id: "2" },
          // @ts-expect-error
          { __typename: "Friend", id: "3" },
        ],
      },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () =>
      useBackgroundQuery(query, {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "useReadQuery",
    ]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1" },
          { __typename: "Friend", id: "2" },
          { __typename: "Friend", id: "3" },
        ],
      },
      dataState: "partial",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      },
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
    });
  }

  subject.next(friends[1]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
        ],
      },
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
    });
  }

  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
    });
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});
