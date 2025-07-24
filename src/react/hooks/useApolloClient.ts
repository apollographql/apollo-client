import * as React from "react";

import type { ApolloClient } from "@apollo/client";
import { invariant } from "@apollo/client/utilities/invariant";

import { getApolloContext } from "../context/ApolloContext.js";

/**
 * @example
 *
 * ```jsx
 * import { useApolloClient } from "@apollo/client";
 *
 * function SomeComponent() {
 *   const client = useApolloClient();
 *   // `client` is now set to the `ApolloClient` instance being used by the
 *   // application (that was configured using something like `ApolloProvider`)
 * }
 * ```
 *
 * @returns The `ApolloClient` instance being used by the application.
 */
export function useApolloClient(override?: ApolloClient): ApolloClient {
  const context = React.useContext(getApolloContext());
  const client = override || context.client;
  invariant(
    !!client,
    'Could not find "client" in the context or passed in as an option. ' +
      "Wrap the root component in an <ApolloProvider>, or pass an ApolloClient " +
      "instance in via options."
  );

  return client;
}
