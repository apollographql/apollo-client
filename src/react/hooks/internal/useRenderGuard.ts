import * as React from "rehackt";

let Ctx: React.Context<null>;

function noop() {}
export function useRenderGuard() {
  if (!Ctx) {
    // we want the intialization to be lazy because `createContext` would error on import in a RSC
    Ctx = React.createContext(null);
  }

  return React.useCallback(
    /**
     * @returns true if the hook was called during render
     */ () => {
      const orig = console.error;
      try {
        console.error = noop;

        /**
         * `useContext` can be called conditionally during render, so this is safe.
         * (Also, during render we would want to throw as a reaction to this anyways, so it
         * wouldn't even matter if we got the order of hooks mixed up...)
         *
         * They cannot however be called outside of Render, and that's what we're testing here.
         *
         * Different versions of React have different behaviour on an invalid hook call:
         *
         * React 16.8 - 17: throws an error
         * https://github.com/facebook/react/blob/2b93d686e359c7afa299e2ec5cf63160a32a1155/packages/react/src/ReactHooks.js#L18-L26
         *
         * React 18 & 19: `console.error` in development, then `resolveDispatcher` returns `null` and a member access on `null` throws.
         * https://github.com/facebook/react/blob/58e8304483ebfadd02a295339b5e9a989ac98c6e/packages/react/src/ReactHooks.js#L28-L35
         */
        React["useContext" /* hide this from the linter */](Ctx);
        return true;
      } catch (e) {
        return false;
      } finally {
        console.error = orig;
      }
    },
    []
  );
}
