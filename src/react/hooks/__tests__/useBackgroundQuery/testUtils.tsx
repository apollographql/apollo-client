import type { RenderOptions } from "@testing-library/react";
import { screen } from "@testing-library/react";
import {
  createRenderStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import type { DataState, ErrorLike, OperationVariables } from "@apollo/client";
import type { QueryRef, useBackgroundQuery } from "@apollo/client/react";
import { useReadQuery } from "@apollo/client/react";

export async function renderUseBackgroundQuery<
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
  ) => [TQueryRef | undefined, useBackgroundQuery.Result<TData, TVariables>],
  options: Pick<RenderOptions, "wrapper"> & { initialProps?: Props }
) {
  function UseReadQuery({ queryRef }: { queryRef: QueryRef }) {
    useTrackRenders({ name: "useReadQuery" });
    replaceSnapshot(useReadQuery(queryRef) as any);

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
    useTrackRenders({ name: "useBackgroundQuery" });
    const [queryRef, { refetch }] = renderHook(props as any);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => replaceSnapshot({ error })}
        >
          {queryRef && <UseReadQuery queryRef={queryRef} />}
          <button onClick={() => refetch()}>refetch</button>
        </ErrorBoundary>
      </Suspense>
    );
  }

  const user = userEvent.setup();
  const { render, takeRender, replaceSnapshot } = createRenderStream<
    useReadQuery.Result<TData, TStates> | { error: ErrorLike }
  >();

  const utils = await render(<App props={options.initialProps} />, options);

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  // refetch needs to be run in an event handler in order for React 18 to commit
  // the suspense fallback
  async function refetch() {
    await user.click(screen.getByText("refetch"));
  }

  return { takeRender, rerender, refetch };
}
