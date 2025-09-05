import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import {
  ApolloClient,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { ApolloProvider, useSuspenseQuery } from "@apollo/client/react";
import {
  markAsStreaming,
  mockDefer20220824,
} from "@apollo/client/testing/internal";

test("suspends deferred queries until initial chunk loads then streams in data as it loads", async () => {
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

  function Component() {
    useTrackRenders();

    const result = useSuspenseQuery<any>(query);
    replaceSnapshot(result);

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders();

    return null;
  }

  function App() {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <Component />
      </Suspense>
    );
  }

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, replaceSnapshot, render } =
    createRenderStream<
      useSuspenseQuery.Result<any, any, "empty" | "complete" | "streaming">
    >();

  await render(<App />, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  });

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([Component]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greeting: { message: "Hello world", __typename: "Greeting" },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
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
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([Component]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});
