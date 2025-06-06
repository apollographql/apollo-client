import * as React from "react";

/**
 * When writing tests that switch between renderers (e.g. between different SSR renderers),
 * we need to reset the Apollo Client context to avoid warnings like:
 * > Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported.
 * This function resets the Apollo Client context to a fresh context.
 * That also prevents context values to be carried from one renderer to another,
 * which might otherwise happen.
 */
export function resetApolloContext() {
  Object.defineProperty(React.createContext, Symbol.for("__APOLLO_CONTEXT__"), {
    value: Object.assign(React.createContext({}), {
      displayName: "ApolloContext",
    }),
    enumerable: false,
    writable: false,
    configurable: true,
  });
}
