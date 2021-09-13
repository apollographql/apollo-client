declare module 'use-sync-external-store' {
  function useSyncExternalStore<T>(
    subscribe: (handleStoreChange: () => void) => () => void,
    getSnapshot: () => T,
  ): T;
}

