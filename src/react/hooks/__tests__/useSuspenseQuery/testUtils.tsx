import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
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

  return { getCurrentSnapshot, rerender, takeRender };
}
