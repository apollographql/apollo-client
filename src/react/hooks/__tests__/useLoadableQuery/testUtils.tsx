import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
import { flushSync } from "react-dom";
import { ErrorBoundary } from "react-error-boundary";

import type { DataState, ErrorLike, OperationVariables } from "@apollo/client";
import {
  type QueryRef,
  type useLoadableQuery,
  useReadQuery,
} from "@apollo/client/react";
import { invariant } from "@apollo/client/utilities/invariant";

export async function renderUseLoadableQueryHook<
  TData,
  TVariables extends OperationVariables,
  TStates extends DataState<TData>["dataState"] = DataState<TData>["dataState"],
  Props = never,
>(
  renderHook: (
    props: Props extends never ? undefined : Props
  ) => useLoadableQuery.Result<TData, TVariables, TStates>,
  options: Pick<RenderOptions, "wrapper"> & { initialProps?: Props }
) {
  function UseReadQuery({
    queryRef,
  }: {
    queryRef: QueryRef<TData, TVariables, TStates>;
  }) {
    useTrackRenders({ name: "useReadQuery" });
    mergeSnapshot({ result: useReadQuery(queryRef) });

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

  type RefetchFunction = useLoadableQuery.Handlers<
    TData,
    TVariables
  >["refetch"];

  function App({ props }: { props: Props | undefined }) {
    useTrackRenders({ name: "useLoadableQuery" });
    const [loadQuery, queryRef, { refetch }] = renderHook(props as any);

    mergeSnapshot({ loadQuery, refetch });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => replaceSnapshot({ error })}
        >
          {queryRef && <UseReadQuery queryRef={queryRef} />}
        </ErrorBoundary>
      </Suspense>
    );
  }

  const {
    render,
    getCurrentRender,
    takeRender,
    mergeSnapshot,
    replaceSnapshot,
  } = createRenderStream<
    | {
        loadQuery: useLoadableQuery.LoadQueryFunction<TVariables>;
        refetch: RefetchFunction;
        result?: useReadQuery.Result<TData, TStates>;
      }
    | { error: ErrorLike }
  >({
    // These values should always be available, but createRenderStream needs an
    // initial snapshot when using mergeSnapshot so we provide it with something
    initialSnapshot: { loadQuery: null as any, refetch: null as any },
  });

  const utils = await render(<App props={options.initialProps} />, options);

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  function getCurrentSnapshot() {
    const { snapshot } = getCurrentRender();
    invariant(
      "loadQuery" in snapshot,
      "Expected rendered hook instead of error boundary"
    );

    return snapshot;
  }

  // React 18 skips committing the suspense fallback when loadQuery/refetch is
  // triggered as a default-priority update, so the fallback render is missed
  // and tests may fail. flushSync forces a synchronous commit so the fallback
  // renders in both React 18 and 19, while returning the underlying result.
  const loadQuery: useLoadableQuery.LoadQueryFunction<TVariables> = (
    ...args
  ) => {
    return flushSync(() => getCurrentSnapshot().loadQuery(...args));
  };

  const refetch: RefetchFunction = (...args) => {
    return flushSync(() => getCurrentSnapshot().refetch(...args));
  };

  return { takeRender, rerender, getCurrentSnapshot, refetch, loadQuery };
}
