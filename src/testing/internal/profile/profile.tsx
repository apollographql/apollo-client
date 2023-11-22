import * as React from "react";

import { TextEncoder, TextDecoder } from "util";

global.TextEncoder ??= TextEncoder;
// @ts-ignore
global.TextDecoder ??= TextDecoder;
import type { Render, BaseRender } from "./Render.js";
import { RenderInstance } from "./Render.js";
import { applyStackTrace, captureStackTrace } from "./traces.js";

type ValidSnapshot = void | (object & { /* not a function */ call?: never });

/** only used for passing around data internally */
const _stackTrace = Symbol();
/** @internal */
export interface NextRenderOptions {
  timeout?: number;
  [_stackTrace]?: string;
}

/** @internal */
interface ProfilerProps {
  children: React.ReactNode;
}

/** @internal */
export interface Profiler<Snapshot>
  extends React.FC<ProfilerProps>,
    ProfiledComponentFields<Snapshot>,
    ProfiledComponentOnlyFields<Snapshot> {}

interface ReplaceSnapshot<Snapshot> {
  (newSnapshot: Snapshot): void;
  (updateSnapshot: (lastSnapshot: Readonly<Snapshot>) => Snapshot): void;
}

interface MergeSnapshot<Snapshot> {
  (partialSnapshot: Partial<Snapshot>): void;
  (
    updatePartialSnapshot: (
      lastSnapshot: Readonly<Snapshot>
    ) => Partial<Snapshot>
  ): void;
}

interface ProfiledComponentOnlyFields<Snapshot> {
  // Allows for partial updating of the snapshot by shallow merging the results
  mergeSnapshot: MergeSnapshot<Snapshot>;
  // Performs a full replacement of the snapshot
  replaceSnapshot: ReplaceSnapshot<Snapshot>;
}
interface ProfiledComponentFields<Snapshot> {
  /**
   * An array of all renders that have happened so far.
   * Errors thrown during component render will be captured here, too.
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
   * Returns the total number of renders.
   */
  totalRenderCount(): number;
  /**
   * Returns the current render.
   * @throws {Error} if no render has happened yet
   */
  getCurrentRender(): Render<Snapshot>;
  /**
   * Waits for the next render to happen.
   * Does not advance the render iterator.
   */
  waitForNextRender(options?: NextRenderOptions): Promise<Render<Snapshot>>;
}

interface ProfilerContextValue {
  renderedComponents: React.ComponentType[];
}
const ProfilerContext = React.createContext<ProfilerContextValue | undefined>(
  undefined
);

/** @internal */
export function createTestProfiler<Snapshot extends ValidSnapshot = void>({
  onRender,
  snapshotDOM = false,
  initialSnapshot,
}: {
  onRender?: (
    info: BaseRender & {
      snapshot: Snapshot;
      replaceSnapshot: ReplaceSnapshot<Snapshot>;
      mergeSnapshot: MergeSnapshot<Snapshot>;
    }
  ) => void;
  snapshotDOM?: boolean;
  initialSnapshot?: Snapshot;
} = {}) {
  let nextRender: Promise<Render<Snapshot>> | undefined;
  let resolveNextRender: ((render: Render<Snapshot>) => void) | undefined;
  let rejectNextRender: ((error: unknown) => void) | undefined;
  const snapshotRef = { current: initialSnapshot };
  const replaceSnapshot: ReplaceSnapshot<Snapshot> = (snap) => {
    if (typeof snap === "function") {
      if (!initialSnapshot) {
        throw new Error(
          "Cannot use a function to update the snapshot if no initial snapshot was provided."
        );
      }
      snapshotRef.current = snap(
        typeof snapshotRef.current === "object"
          ? // "cheap best effort" to prevent accidental mutation of the last snapshot
            { ...snapshotRef.current! }
          : snapshotRef.current!
      );
    } else {
      snapshotRef.current = snap;
    }
  };

  const mergeSnapshot: MergeSnapshot<Snapshot> = (partialSnapshot) => {
    replaceSnapshot((snapshot) => ({
      ...snapshot,
      ...(typeof partialSnapshot === "function"
        ? partialSnapshot(snapshot)
        : partialSnapshot),
    }));
  };

  const profilerContext: ProfilerContextValue = {
    renderedComponents: [],
  };

  const profilerOnRender: React.ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    const baseRender = {
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      count: Profiler.renders.length + 1,
    };
    try {
      /*
       * The `onRender` function could contain `expect` calls that throw
       * `JestAssertionError`s - but we are still inside of React, where errors
       * might be swallowed.
       * So we record them and re-throw them in `takeRender`
       * Additionally, we reject the `waitForNextRender` promise.
       */
      onRender?.({
        ...baseRender,
        replaceSnapshot,
        mergeSnapshot,
        snapshot: snapshotRef.current!,
      });

      const snapshot = snapshotRef.current as Snapshot;
      const domSnapshot = snapshotDOM
        ? window.document.body.innerHTML
        : undefined;
      const render = new RenderInstance(
        baseRender,
        snapshot,
        domSnapshot,
        profilerContext.renderedComponents
      );
      profilerContext.renderedComponents = [];
      Profiler.renders.push(render);
      resolveNextRender?.(render);
    } catch (error) {
      Profiler.renders.push({
        phase: "snapshotError",
        count: Profiler.renders.length,
        error,
      });
      rejectNextRender?.(error);
    } finally {
      nextRender = resolveNextRender = rejectNextRender = undefined;
    }
  };

  let iteratorPosition = 0;
  const Profiler: Profiler<Snapshot> = Object.assign(
    ({ children }: ProfilerProps) => {
      const parentContext = React.useContext(ProfilerContext);

      if (parentContext) {
        throw new Error("Should not nest profiled components.");
      }

      return (
        <ProfilerContext.Provider value={profilerContext}>
          <React.Profiler id="test" onRender={profilerOnRender}>
            {children}
          </React.Profiler>
        </ProfilerContext.Provider>
      );
    },
    {
      replaceSnapshot,
      mergeSnapshot,
    } satisfies ProfiledComponentOnlyFields<Snapshot>,
    {
      renders: new Array<
        | Render<Snapshot>
        | { phase: "snapshotError"; count: number; error: unknown }
      >(),
      totalRenderCount() {
        return Profiler.renders.length;
      },
      async peekRender(options: NextRenderOptions = {}) {
        if (iteratorPosition < Profiler.renders.length) {
          const render = Profiler.renders[iteratorPosition];

          if (render.phase === "snapshotError") {
            throw render.error;
          }

          return render;
        }
        return Profiler.waitForNextRender({
          [_stackTrace]: captureStackTrace(Profiler.peekRender),
          ...options,
        });
      },
      async takeRender(options: NextRenderOptions = {}) {
        let error: unknown = undefined;
        try {
          return await Profiler.peekRender({
            [_stackTrace]: captureStackTrace(Profiler.takeRender),
            ...options,
          });
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
        // The "current" render should point at the same render that the most
        // recent `takeRender` call returned, so we need to get the "previous"
        // iterator position, otherwise `takeRender` advances the iterator
        // to the next render. This means we need to call `takeRender` at least
        // once before we can get a current render.
        const currentPosition = iteratorPosition - 1;

        if (currentPosition < 0) {
          throw new Error(
            "No current render available. You need to call `takeRender` before you can get the current render."
          );
        }

        const render = Profiler.renders[currentPosition];

        if (render.phase === "snapshotError") {
          throw render.error;
        }
        return render;
      },
      waitForNextRender({
        timeout = 1000,
        // capture the stack trace here so its stack trace is as close to the calling code as possible
        [_stackTrace]: stackTrace = captureStackTrace(
          Profiler.waitForNextRender
        ),
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
    } satisfies ProfiledComponentFields<Snapshot>
  );
  return Profiler;
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

type ProfiledHookFields<ReturnValue> =
  ProfiledComponentFields<ReturnValue> extends infer PC
    ? {
        [K in keyof PC as StringReplaceRenderWithSnapshot<
          K & string
        >]: ResultReplaceRenderWithSnapshot<PC[K]>;
      }
    : never;

/** @internal */
export interface ProfiledHook<Props, ReturnValue>
  extends React.FC<Props>,
    ProfiledHookFields<ReturnValue> {
  ProfiledComponent: Profiler<ReturnValue>;
}

/** @internal */
export function profileHook<ReturnValue extends ValidSnapshot, Props>(
  renderCallback: (props: Props) => ReturnValue,
  { displayName = renderCallback.name || "ProfiledHook" } = {}
): ProfiledHook<Props, ReturnValue> {
  let returnValue: ReturnValue;
  const ProfiledHook = (props: Props) => {
    ProfiledComponent.replaceSnapshot(renderCallback(props));
    return null;
  };
  ProfiledHook.displayName = displayName;
  const ProfiledComponent = createTestProfiler<ReturnValue>({
    onRender: () => returnValue,
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
      totalSnapshotCount: ProfiledComponent.totalRenderCount,
      async peekSnapshot(options) {
        return (await ProfiledComponent.peekRender(options)).snapshot;
      },
      async takeSnapshot(options) {
        return (await ProfiledComponent.takeRender(options)).snapshot;
      },
      getCurrentSnapshot() {
        return ProfiledComponent.getCurrentRender().snapshot;
      },
      async waitForNextSnapshot(options) {
        return (await ProfiledComponent.waitForNextRender(options)).snapshot;
      },
    } satisfies ProfiledHookFields<ReturnValue>
  );
}

export function useTrackComponentRender() {
  const owner: React.ComponentType | undefined = (React as any)
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentOwner
    ?.current?.elementType;

  if (!owner) {
    throw new Error("useTrackComponentRender: Unable to determine hook owner");
  }

  const ctx = React.useContext(ProfilerContext);
  React.useLayoutEffect(() => {
    ctx?.renderedComponents.unshift(owner);
  });
}
