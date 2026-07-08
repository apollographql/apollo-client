import type { RenderOptions } from "@testing-library/react";
import { screen } from "@testing-library/react";
import {
  createRenderStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
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
    // eslint-disable-next-line testing-library/render-result-naming-convention
    const result = renderHook(props as any);
    replaceSnapshot(result);

    // We need to trigger refetch in an event handler in order for React 18 to
    // commit the suspense fallback, otherwise the suspense fallback render is
    // skipped and tests may fail.
    return <button onClick={() => result.refetch()}>refetch</button>;
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

  const user = userEvent.setup();
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

  async function refetch() {
    await user.click(screen.getByText("refetch"));
  }

  return { getCurrentSnapshot, rerender, takeRender, refetch };
}
