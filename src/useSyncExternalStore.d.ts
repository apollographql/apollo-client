declare module 'use-sync-external-store' {
  function useSyncExternalStore<T>(
    subscribe: (fn: () => void) => () => void,
    getSnapshot: () => T,
  ): T;
}

