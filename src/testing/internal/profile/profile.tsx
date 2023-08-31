import * as React from "react";

import { TextEncoder, TextDecoder } from "util";

global.TextEncoder ??= TextEncoder;
// @ts-ignore
global.TextDecoder ??= TextDecoder;
import type { Render, BaseRender } from "./Render.js";
import { RenderInstance } from "./Render.js";
import { applyStackTrace, captureStackTrace } from "./traces.js";

interface NextRenderOptions {
  timeout?: number;
  stackTrace?: string;
}

interface ProfiledComponent<Props, Snapshot> extends React.FC<Props> {
  renders: Array<
    Render<Snapshot> | { phase: "snapshotError"; count: number; error: unknown }
  >;
  peekRender(options?: NextRenderOptions): Promise<Render<Snapshot>>;
  takeRender(options?: NextRenderOptions): Promise<Render<Snapshot>>;
  getCurrentRender(): Render<Snapshot>;
  waitForRenderCount(count: number): Promise<void>;
  waitForNextRender(options?: NextRenderOptions): Promise<Render<Snapshot>>;
}

/**
 * @internal Should not be exported by the library.
 */
export function profile<Props, Snapshot = void>({
  Component,
  takeSnapshot,
  snapshotDOM = false,
}: {
  Component: React.ComponentType<Props>;
  takeSnapshot?: (render: BaseRender) => Snapshot;
  snapshotDOM?: boolean;
}) {
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
      const domSnapshot = snapshotDOM
        ? window.document.body.innerHTML
        : undefined;
      const render = new RenderInstance(baseRender, snapshot, domSnapshot);
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
  const Profiled: ProfiledComponent<Props, Snapshot> = Object.assign(
    (props: Props) => (
      <React.Profiler id="test" onRender={onRender}>
        <Component {...(props as any)} />
      </React.Profiler>
    ),
    {
      renders: new Array<
        | Render<Snapshot>
        | { phase: "snapshotError"; count: number; error: unknown }
      >(),
      async peekRender(options: NextRenderOptions = {}) {
        if (iteratorPosition < Profiled.renders.length) {
          const render = Profiled.renders[iteratorPosition];
          if (render.phase === "snapshotError") {
            throw render.error;
          }
          return render;
        }
        const render = Profiled.waitForNextRender({
          stackTrace: captureStackTrace(Profiled.takeRender),
          ...options,
        });
        return render;
      },
      async takeRender(options: NextRenderOptions = {}) {
        let error: { message?: string } | undefined = undefined;
        try {
          return await Profiled.peekRender(options);
        } catch (e) {
          error = e;
          throw e;
        } finally {
          if (
            !(
              error &&
              error.message == "Exceeded timeout waiting for next render."
            )
          ) {
            iteratorPosition++;
          }
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
      waitForNextRender({
        timeout = 1000,
        // capture the stack trace here so its stack trace is as close to the calling code as possible
        stackTrace = captureStackTrace(Profiled.waitForNextRender),
      }: NextRenderOptions = {}) {
        if (!nextRender) {
          nextRender = Promise.race<Render<Snapshot>>([
            new Promise<Render<Snapshot>>((resolve, reject) => {
              resolveNextRender = resolve;
              rejectNextRender = reject;
            }),
            new Promise<Render<Snapshot>>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    applyStackTrace(
                      new Error("Exceeded timeout waiting for next render."),
                      stackTrace
                    )
                  ),
                timeout
              )
            ),
          ]);
        }
        return nextRender;
      },
    }
  );
  return Profiled;
}

export function profileHook<Props, ReturnValue>(
  hook: (props: Props) => ReturnValue
) {
  let returnValue: ReturnValue;
  const Component = (props: Props) => {
    returnValue = hook(props);
    return <></>;
  };
  return profile({ Component, takeSnapshot: () => returnValue });
}
