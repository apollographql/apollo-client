import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";

import type { OperationVariables } from "@apollo/client";
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

const IS_REACT_19 = React.version.startsWith("19");

async function renderSuspenseHook<TData, TVariables extends OperationVariables>(
  renderHook: () => useSuspenseQuery.Result<TData, TVariables>,
  options: Pick<RenderOptions, "wrapper">
) {
  function UseSuspenseQuery() {
    useTrackRenders({ name: "useSuspenseQuery" });
    renderStream.replaceSnapshot(renderHook());

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "SuspenseFallback" });

    return null;
  }

  function App() {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <UseSuspenseQuery />
      </Suspense>
    );
  }

  const { render, takeRender, ...renderStream } =
    createRenderStream<useSuspenseQuery.Result<TData, TVariables>>();

  const utils = await render(<App />, options);

  function rerender() {
    return utils.rerender(<App />);
  }

  return { takeRender, rerender };
}

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

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
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

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
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
