import * as React from "react";

import { TextEncoder, TextDecoder } from "util";

global.TextEncoder ??= TextEncoder;
// @ts-ignore
global.TextDecoder ??= TextDecoder;
import type { Render, BaseRender } from "./Render.js";
import { RenderInstance } from "./Render.js";
import { applyStackTrace, captureStackTrace } from "./traces.js";

/** @internal */
export interface NextRenderOptions {
  timeout?: number;
  stackTrace?: string;
}

/** @internal */
export interface ProfiledComponent<Props, Snapshot>
  extends React.FC<Props>,
    ProfiledComponentFields<Props, Snapshot> {}
interface ProfiledComponentFields<Props, Snapshot> {
  /**
   * An array of all renders that have happened so far.
   * Errors thrown during component rember will be captured here, too.
   */
  renders: Array<
    Render<Snapshot> | { phase: "snapshotError"; count: number; error: unknown }
  >;
  /**
   * Peeks the next render from the current iterator position, without advancing the iterator.
   * If no render has happened yet, it will wait for the next render to happen.
   * @throws {WaitForRenderTimeoutError} if no render happens within the timeout
   */
  peekRender(options?: NextRenderOptions): Promise<Render<Snapshot>>;
  /**
   * Iterates to the next render and returns it.
   * If no render has happened yet, it will wait for the next render to happen.
   * @throws {WaitForRenderTimeoutError} if no render happens within the timeout
   */
  takeRender(options?: NextRenderOptions): Promise<Render<Snapshot>>;
  /**
   * Returns the current render count.
   */
  currentRenderCount(): number;
  /**
   * Returns the current render.
   * @throws {Error} if no render has happened yet
   */
  getCurrentRender(): Render<Snapshot>;
  /**
   * Iterates the renders until the render count is reached.
   */
  takeUntilRenderCount(
    count: number,
    optionsPerRender?: NextRenderOptions
  ): Promise<void>;
  /**
   * Waits for the next render to happen.
   * Does not advance the render iterator.
   */
  waitForNextRender(options?: NextRenderOptions): Promise<Render<Snapshot>>;
}

/** @internal */
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
      currentRenderCount() {
        return Profiled.renders.length;
      },
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
          if (!(error && error instanceof WaitForRenderTimeoutError)) {
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
      async takeUntilRenderCount(
        count: number,
        optionsPerRender?: NextRenderOptions
      ) {
        while (Profiled.renders.length < count) {
          await Profiled.takeRender(optionsPerRender);
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
                    applyStackTrace(new WaitForRenderTimeoutError(), stackTrace)
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

/** @internal */
export class WaitForRenderTimeoutError extends Error {
  constructor() {
    super("Exceeded timeout waiting for next render.");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type StringReplaceRenderWithSnapshot<T extends string> =
  T extends `${infer Pre}Render${infer Post}` ? `${Pre}Snapshot${Post}` : T;

type ResultReplaceRenderWithSnapshot<T> = T extends (
  ...args: infer Args
) => Render<infer Snapshot>
  ? (...args: Args) => Snapshot
  : T extends (...args: infer Args) => Promise<Render<infer Snapshot>>
  ? (...args: Args) => Promise<Snapshot>
  : T;

type ProfiledHookFields<Props, ReturnValue> = Omit<
  ProfiledComponent<Props, ReturnValue>,
  keyof React.FC<Props>
> extends infer PC
  ? {
      [K in keyof PC as StringReplaceRenderWithSnapshot<
        K & string
      >]: ResultReplaceRenderWithSnapshot<PC[K]>;
    }
  : never;

/** @internal */
export interface ProfiledHook<Props, ReturnValue>
  extends React.FC<Props>,
    ProfiledHookFields<Props, ReturnValue> {
  ProfiledComponent: ProfiledComponent<Props, ReturnValue>;
}

/** @internal */
export function profileHook<Props, ReturnValue>(
  renderCallback: (props: Props) => ReturnValue
): ProfiledHook<Props, ReturnValue> {
  let returnValue: ReturnValue;
  const Component = (props: Props) => {
    returnValue = renderCallback(props);
    return null;
  };
  const ProfiledComponent = profile({
    Component,
    takeSnapshot: () => returnValue,
  });
  return Object.assign(
    function ProfiledHook(props: Props) {
      return <ProfiledComponent {...(props as any)} />;
    },
    {
      ProfiledComponent,
    },
    {
      renders: ProfiledComponent.renders,
      currentSnapshotCount: ProfiledComponent.currentRenderCount,
      async peekSnapshot(options) {
        return (await ProfiledComponent.peekRender(options)).snapshot;
      },
      async takeSnapshot(options) {
        return (await ProfiledComponent.takeRender(options)).snapshot;
      },
      getCurrentSnapshot() {
        return ProfiledComponent.getCurrentRender().snapshot;
      },
      takeUntilSnapshotCount: ProfiledComponent.takeUntilRenderCount,
      async waitForNextSnapshot(options) {
        return (await ProfiledComponent.waitForNextRender(options)).snapshot;
      },
    } satisfies ProfiledHookFields<Props, ReturnValue>
  );
}
