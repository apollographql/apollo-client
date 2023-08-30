import * as React from "react";
import { useSyncExternalStore } from "./useSyncExternalStore.js";
import { invariant } from "../../utilities/globals/invariantWrappers.js";

export function useTrackedExternalStore<Snapshot extends object>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot?: (() => Snapshot) | undefined
): Snapshot {
  // TODO: assess if we should only track observed props between start and end of a render
  const observedProps = React.useRef(new Set<keyof Snapshot>());

  const target = React.useRef<Snapshot>();
  const wrapper = React.useRef<Snapshot>();
  function wrapGetSnapshot<T extends (() => Snapshot) | undefined>(
    getSnapshot: T
  ) {
    if (!getSnapshot) return getSnapshot;

    return function wrapped() {
      const lastSnapshot = target.current;
      const currentSnapshot = (target.current = getSnapshot());

      if (!currentSnapshot) return currentSnapshot;
      if (currentSnapshot === lastSnapshot) return wrapper.current!;

      let observedPropsChanged = false;
      if (lastSnapshot) {
        observedProps.current.forEach((prop) => {
          if (currentSnapshot[prop] !== lastSnapshot[prop]) {
            observedPropsChanged = true;
          }
        });
      }

      if (observedPropsChanged || !wrapper.current) {
        // this should trigger a rerender - create a new object instance to return
        wrapper.current = createWrapper(
          target as React.RefObject<Snapshot>,
          observedProps.current
        );
      }
      if (__DEV__) {
        validateWrapper(wrapper.current, currentSnapshot);
      }
      return wrapper.current;
    };
  }

  return useSyncExternalStore(
    subscribe,
    React.useMemo(() => wrapGetSnapshot(getSnapshot), [getSnapshot]),
    React.useMemo(() => wrapGetSnapshot(getServerSnapshot), [getServerSnapshot])
  );
}

/**
 * Until we can make sure that Proxy is available in all browsers,
 * we use this getter-based approach that would also be used by a Proxy
 * polyfill.
 */
function createWrapper<Snapshot>(
  target: React.RefObject<Snapshot>,
  observedProps: Set<keyof Snapshot>
) {
  const wrapper = {} as Snapshot;
  for (const key in target.current) {
    if (!target.current.hasOwnProperty(key)) {
      continue;
    }
    Object.defineProperty(wrapper, key, {
      enumerable: true,
      get() {
        observedProps.add(key as keyof Snapshot);
        return target.current![key];
      },
    });
  }
  return wrapper;
}

/**
 * We need to make sure that the wrapper object has all the properties that should
 * be observed from the beginning, as otherwise we could miss "dirty markers".
 * Even if we went with a Proxy-based approach, as long as we can't 100% assume that
 * our consumers are not using a polyfill, this is necessary.
 */
function validateWrapper<Snapshot extends object>(
  wrapper: Snapshot,
  value: Snapshot
) {
  for (const key in value) {
    if (!value.hasOwnProperty(key)) {
      continue;
    }
    invariant(
      wrapper.hasOwnProperty(key),
      "Tracked value %s received new property %s after wrapper creation. This is a bug in Apollo Client, please report it to us!",
      JSON.stringify(value),
      key
    );
  }
}
