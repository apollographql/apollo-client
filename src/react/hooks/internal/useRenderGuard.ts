import * as React from "rehackt";

function getRenderDispatcher() {
  return (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
    ?.ReactCurrentDispatcher?.current;
}

let RenderDispatcher: unknown = null;

/*
Relay does this too, so we hope this is safe.
https://github.com/facebook/relay/blob/8651fbca19adbfbb79af7a3bc40834d105fd7747/packages/react-relay/relay-hooks/loadQuery.js#L90-L98
*/
export function useRenderGuard() {
  RenderDispatcher = getRenderDispatcher();

  // We use a callback argument here instead of the failure string so that the
  // call site can provide a custom failure message while allowing for static
  // message extraction on the `invariant` function.
  return React.useCallback((onFailure: () => void) => {
    if (
      RenderDispatcher !== null &&
      RenderDispatcher === getRenderDispatcher()
    ) {
      onFailure();
    }
  }, []);
}
