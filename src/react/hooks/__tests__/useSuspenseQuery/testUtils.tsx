import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
import { flushSync } from "react-dom";
import { ErrorBoundary } from "react-error-boundary";

import type { ErrorLike, OperationVariables } from "@apollo/client";
import type { useSuspenseQuery } from "@apollo/client/react";
import { invariant } from "@apollo/client/utilities/invariant";

export async function renderUseSuspenseQuery<
  TData,
  TVariables extends OperationVariables,
  Props = never,
>(
  renderHook: (props: any) => any,
  options: Pick<RenderOptions, "wrapper"> & { initialProps?: Props }
) {
  function UseSuspenseQuery({ props }: { props: Props | undefined }) {
    useTrackRenders({ name: "useSuspenseQuery" });
    replaceSnapshot(renderHook(props as any));

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "<Suspense />" });

    return null;
  }

  function ErrorFallback() {
    useTrackRenders({ name: "<ErrorBoundary />" });

    return null;
  }

  function App({ props }: { props: Props | undefined }) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => replaceSnapshot({ error })}
        >
          <UseSuspenseQuery props={props} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  const { render, takeRender, replaceSnapshot, getCurrentRender } =
    createRenderStream<
      useSuspenseQuery.Result<TData, TVariables> | { error: ErrorLike }
    >({ skipNonTrackingRenders: true });

  const utils = await render(<App props={options.initialProps} />, options);

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  function getCurrentSnapshot() {
    const { snapshot } = getCurrentRender();

    invariant("data" in snapshot, "Snapshot is not a hook snapshot");

    return snapshot;
  }

  // React 18 skips committing the suspense fallback when refetch is triggered
  // as a default-priority update, so the fallback render is missed and tests
  // may fail. flushSync forces a synchronous commit so the fallback renders in
  // both React 18 and 19, while returning the refetch promise.
  const refetch: useSuspenseQuery.Result<TData, TVariables>["refetch"] = (
    ...args
  ) => {
    return flushSync(() => getCurrentSnapshot().refetch(...args));
  };

  return { getCurrentSnapshot, rerender, takeRender, refetch };
}
