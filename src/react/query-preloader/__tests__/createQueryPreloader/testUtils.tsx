import {
  createRenderStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import type { ApolloClient, DataState } from "@apollo/client";
import type { QueryRef } from "@apollo/client/react";
import { useReadQuery } from "@apollo/client/react";
import { createClientWrapper } from "@apollo/client/testing/internal";

export async function renderDefaultTestApp<
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
    useTrackRenders({ name: "useReadQuery" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "<Suspense />" });
    return <p>Loading</p>;
  }

  function ErrorFallback({ error }: { error: Error }) {
    useTrackRenders({ name: "Error" });
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
    wrapper: createClientWrapper(client),
  });

  function rerender() {
    return utils.rerender(<App />);
  }

  return { ...utils, rerender, renderStream };
}
