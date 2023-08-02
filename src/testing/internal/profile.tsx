import * as React from "react";

export interface Render<Snapshot> {
  id: string;
  phase: "mount" | "update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  interactions: Set<import("scheduler/tracing").Interaction>;
  count: number;
  snapshot: Snapshot;
}

/**
 * @internal Should not be exported by the library.
 */
export function profile<
  Props extends React.JSX.IntrinsicAttributes,
  Snapshot = void,
>(
  Component: React.ComponentType<Props>,
  takeSnapshot?: (render: Render<void>) => Snapshot
) {
  let currentRender: Render<Snapshot> | undefined;
  let nextRender: Promise<Render<Snapshot>> | undefined;
  let resolveNextRender: ((render: Render<Snapshot>) => void) | undefined;
  let rejectNextRender: ((error: unknown) => void) | undefined;
  const onRender: React.ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    interactions
  ) => {
    const baseRender = {
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      interactions,
      count: Profiled.renders.length + 1,
      snapshot: undefined,
    };
    try {
      /*
       * The `takeSnapshot` function could contain `expect` calls that throw
       * `JestAssertionError`s - but we are still inside of React, where errors
       * might be swallowed.
       * So we record them and re-throw them in `takeRender`
       * Additionally, we reject the `waitForNextRender` promise.
       */
      const snapshot = takeSnapshot?.(baseRender) as Snapshot;
      const render = { ...baseRender, snapshot };
      // eslint-disable-next-line testing-library/render-result-naming-convention
      currentRender = render;
      Profiled.renders.push(render);
      const resolve = resolveNextRender;
      nextRender = resolveNextRender = rejectNextRender = undefined;
      resolve?.(render);
    } catch (error) {
      Profiled.renders.push({
        phase: "snapshotError",
        count: Profiled.renders.length,
        error,
      });
      const reject = rejectNextRender;
      nextRender = resolveNextRender = rejectNextRender = undefined;
      reject?.(error);
    }
  };

  let iteratorPosition = 0;
  const Profiled = Object.assign(
    (props: Props) => (
      <React.Profiler id="test" onRender={onRender}>
        <Component {...props} />
      </React.Profiler>
    ),
    {
      renders: new Array<
        | Render<Snapshot>
        | { phase: "snapshotError"; count: number; error: unknown }
      >(),
      async takeRender() {
        try {
          if (iteratorPosition < Profiled.renders.length) {
            const render = Profiled.renders[iteratorPosition];
            if (render.phase === "snapshotError") {
              throw render.error;
            }
            return render;
          }
          return Profiled.waitForNextRender();
        } finally {
          iteratorPosition++;
        }
      },
      getCurrentRender() {
        if (!currentRender) {
          throw new Error("Has not been rendered yet!");
        }
        return currentRender;
      },
      async waitForRenderCount(count: number) {
        while (Profiled.renders.length < count) {
          await Profiled.takeRender();
        }
      },
      waitForNextRender() {
        if (!nextRender) {
          nextRender = new Promise((resolve, reject) => {
            resolveNextRender = resolve;
            rejectNextRender = reject;
          });
        }
        return nextRender;
      },
    }
  );
  return Profiled;
}
