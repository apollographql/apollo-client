import * as React from "rehackt";
import type * as ReactTypes from "react";
import type { ApolloClient } from "../../core/index.js";
import { canUseSymbol } from "../../utilities/index.js";
import type { RenderPromises } from "../ssr/index.js";
import { invariant } from "../../utilities/globals/index.js";

export interface ApolloContextValue {
  client?: ApolloClient<object>;
  renderPromises?: RenderPromises;
}

// To make sure Apollo Client doesn't create more than one React context
// (which can lead to problems like having an Apollo Client instance added
// in one context, then attempting to retrieve it from another different
// context), a single Apollo context is created and tracked in global state.
const contextKey =
  canUseSymbol ? Symbol.for("__APOLLO_CONTEXT__") : "__APOLLO_CONTEXT__";

export function getApolloContext(): ReactTypes.Context<ApolloContextValue> {
  invariant(
    "createContext" in React,
    "Invoking `getApolloContext` in an environment where `React.createContext` is not available.\n" +
      "The Apollo Client functionality you are trying to use is only available in React Client Components.\n" +
      'Please make sure to add "use client" at the top of your file.\n' +
      // TODO: change to React documentation once React documentation contains information about Client Components
      "For more information, see https://nextjs.org/docs/getting-started/react-essentials#client-components"
  );

  let context = (React.createContext as any)[
    contextKey
  ] as React.Context<ApolloContextValue>;
  if (!context) {
    Object.defineProperty(React.createContext, contextKey, {
      value: (context = React.createContext<ApolloContextValue>({})),
      enumerable: false,
      writable: false,
      configurable: true,
    });
    context.displayName = "ApolloContext";
  }
  return context;
}

/**
 * @deprecated This function has no "resetting" effect since Apollo Client 3.4.12,
 * and will be removed in the next major version of Apollo Client.
 * If you want to get the Apollo Context, use `getApolloContext` instead.
 */
export const resetApolloContext = getApolloContext;
