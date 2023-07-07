import * as React from 'react';

export function useStrictModeSafeCleanupEffect(cleanup: () => void) {
  let timeout: NodeJS.Timeout;

  React.useEffect(() => {
    clearTimeout(timeout);

    return () => {
      timeout = setTimeout(cleanup);
    };
  }, []);
}
