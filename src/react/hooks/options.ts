import { useRef } from "react";
import equal from "@wry/equality";

import {
  QueryHookOptions,
  LazyQueryHookOptions,
} from "../types/types";

// I would have made this function a method of the InternalState class, but it
// needs to run before we get the client from useApolloClient in the useQuery
// function above, just in case the options function returns options.client as
// an override for the ApolloClient instance provided by React context.
export function useNormalizedOptions<
  TOptions extends
    | QueryHookOptions<any, any>
    | LazyQueryHookOptions<any, any>
>(
  optionsOrFunction?:
    | TOptions
    | ((prevOptions: TOptions) => TOptions)
): TOptions {
  const optionsRef = useRef<TOptions>();
  let options: TOptions = optionsRef.current || Object.create(null);

  if (typeof optionsOrFunction === "function") {
    const newOptions = optionsOrFunction(options);
    if (newOptions !== options) {
      Object.assign(options, newOptions, newOptions.variables && {
        variables: {
          ...options.variables,
          ...newOptions.variables,
        },
      });
    }
  } else if (optionsOrFunction && !equal(optionsOrFunction, options)) {
    options = optionsOrFunction;
  }

  return optionsRef.current = options;
}
