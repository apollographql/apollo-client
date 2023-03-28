import { useEffect } from 'react';

export function useStrictModeSafeCleanupEffect(cleanup: () => void) {
  let timeout: NodeJS.Timeout;

  useEffect(() => {
    clearTimeout(timeout);

    return () => {
      timeout = setTimeout(cleanup);
    };
  }, []);
}
