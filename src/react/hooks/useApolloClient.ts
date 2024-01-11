import { invariant } from "../../utilities/globals/index.js";
import * as React from "rehackt";
import type { ApolloClient } from "../../core/index.js";
import { getApolloContext } from "../context/index.js";

/**
 * @example
 * ```jsx
 * import { useApolloClient } from '@apollo/client';
 *
 * function SomeComponent() {
 *   const client = useApolloClient();
 *   // `client` is now set to the `ApolloClient` instance being used by the
 *   // application (that was configured using something like `ApolloProvider`)
 * }
 * ```
 *
 * @since 3.0.0
 * @returns The `ApolloClient` instance being used by the application.
 */
export function useApolloClient(
  override?: ApolloClient<object>
): ApolloClient<object> {
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
