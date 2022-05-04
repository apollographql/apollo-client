import { invariant } from '../../utilities/globals';
import * as React from 'react';

import { canUseDOM } from '../../utilities';

const ReactWithSESHook = React as (typeof React & {
  useSyncExternalStore?: typeof useSyncExternalStore;
});

let didWarnUncachedGetSnapshot = false;

// Adapted from https://www.npmjs.com/package/use-sync-external-store, with
// Apollo Client deviations called out by "// DEVIATION ..." comments.

export function useSyncExternalStore<Snapshot>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot?: () => Snapshot,
): Snapshot {
  // When/if React.useSyncExternalStore is defined, delegate fully to it.
  const realHook = ReactWithSESHook.useSyncExternalStore;
  if (realHook) {
    return realHook(subscribe, getSnapshot, getServerSnapshot);
  }

  // Read the current snapshot from the store on every render. Again, this
  // breaks the rules of React, and only works here because of specific
  // implementation details, most importantly that updates are
  // always synchronous.
  const value = getSnapshot();
  if (
    // DEVIATION: Using our own __DEV__ polyfill (from ../../utilities/globals).
    __DEV__ &&
    !didWarnUncachedGetSnapshot &&
    // DEVIATION: Not using Object.is because we know our snapshots will never
    // be exotic primitive values like NaN, which is !== itself.
    value !== getSnapshot()
  ) {
    didWarnUncachedGetSnapshot = true;
    // DEVIATION: Using invariant.error instead of console.error directly.
    invariant.error(
      'The result of getSnapshot should be cached to avoid an infinite loop',
    );
  }

  // Because updates are synchronous, we don't queue them. Instead we force a
  // re-render whenever the subscribed state changes by updating an some
  // arbitrary useState hook. Then, during render, we call getSnapshot to read
  // the current value.
  //
  // Because we don't actually use the state returned by the useState hook, we
  // can save a bit of memory by storing other stuff in that slot.
  //
  // To implement the early bailout, we need to track some things on a mutable
  // object. Usually, we would put that in a useRef hook, but we can stash it in
  // our useState hook instead.
  //
  // To force a re-render, we call forceUpdate({inst}). That works because the
  // new object always fails an equality check.
  const [{inst}, forceUpdate] = React.useState({inst: {value, getSnapshot}});

  // Track the latest getSnapshot function with a ref. This needs to be updated
  // in the layout phase so we can access it during the tearing check that
  // happens on subscribe.
  if (canUseDOM) {
    // DEVIATION: We avoid calling useLayoutEffect when !canUseDOM, which may
    // seem like a conditional hook, but this code ends up behaving
    // unconditionally (one way or the other) because canUseDOM is constant.
    React.useLayoutEffect(() => {
      Object.assign(inst, { value, getSnapshot });
      // Whenever getSnapshot or subscribe changes, we need to check in the
      // commit phase if there was an interleaved mutation. In concurrent mode
      // this can happen all the time, but even in synchronous mode, an earlier
      // effect may have mutated the store.
      if (checkIfSnapshotChanged(inst)) {
        // Force a re-render.
        forceUpdate({inst});
      }
    }, [subscribe, value, getSnapshot]);
  } else {
    Object.assign(inst, { value, getSnapshot });
  }

  React.useEffect(() => {
    // Check for changes right before subscribing. Subsequent changes will be
    // detected in the subscription handler.
    if (checkIfSnapshotChanged(inst)) {
      // Force a re-render.
      forceUpdate({inst});
    }

    // Subscribe to the store and return a clean-up function.
    return subscribe(function handleStoreChange() {
      // TODO: Because there is no cross-renderer API for batching updates, it's
      // up to the consumer of this library to wrap their subscription event
      // with unstable_batchedUpdates. Should we try to detect when this isn't
      // the case and print a warning in development?

      // The store changed. Check if the snapshot changed since the last time we
      // read from the store.
      if (checkIfSnapshotChanged(inst)) {
        // Force a re-render.
        forceUpdate({inst});
      }
    });
  }, [subscribe]);

  return value;
}

function checkIfSnapshotChanged<Snapshot>({
  value,
  getSnapshot,
}: {
  value: Snapshot;
  getSnapshot: () => Snapshot;
}): boolean {
  try {
    return value !== getSnapshot();
  } catch {
    return true;
  }
}
