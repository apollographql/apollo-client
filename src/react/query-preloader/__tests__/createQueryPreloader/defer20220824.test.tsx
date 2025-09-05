import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import type { DataState } from "@apollo/client";
import { ApolloClient, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import type { QueryRef } from "@apollo/client/react";
import {
  ApolloProvider,
  createQueryPreloader,
  useReadQuery,
} from "@apollo/client/react";
import {
  markAsStreaming,
  mockDefer20220824,
} from "@apollo/client/testing/internal";

async function renderDefaultTestApp<
  TData,
  TStates extends DataState<TData>["dataState"] = "complete" | "streaming",
>({
  client,
  queryRef,
}: {
  client: ApolloClient;
  queryRef: QueryRef<TData, any, TStates>;
}) {
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<TData, TStates> | null,
      error: null as Error | null,
    },
  });

  function ReadQueryHook() {
    useTrackRenders({ name: "ReadQueryHook" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "SuspenseFallback" });
    return <p>Loading</p>;
  }

  function ErrorFallback({ error }: { error: Error }) {
    useTrackRenders({ name: "ErrorFallback" });
    renderStream.mergeSnapshot({ error });

    return null;
  }

  function App() {
    useTrackRenders({ name: "App" });

    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook />
        </Suspense>
      </ErrorBoundary>
    );
  }

  const utils = await renderStream.render(<App />, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  });

  function rerender() {
    return utils.rerender(<App />);
  }

  return { ...utils, rerender, renderStream };
}

test("suspends deferred queries until initial chunk loads then rerenders with deferred data", async () => {
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

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: markAsStreaming({
        greeting: { message: "Hello world", __typename: "Greeting" },
      }),
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
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
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

