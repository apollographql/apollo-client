import { global } from "@apollo/client/utilities/internal/globals";

import type { ErrorCodes } from "../invariantErrorCodes.js";

import type { ErrorMessageHandler } from "./setErrorMessageHandler.js";
import { setErrorMessageHandler } from "./setErrorMessageHandler.js";
import { ApolloErrorMessageHandler } from "./symbol.js";

/**
 * Injects Apollo Client's default error message handler into the application and
 * also loads the error codes that are passed in as arguments.
 */
export function loadErrorMessageHandler(...errorCodes: ErrorCodes[]) {
  setErrorMessageHandler(handler as typeof handler & ErrorCodes);

  for (const codes of errorCodes) {
    Object.assign(handler, codes);
  }

  return handler;
}

const handler = ((message: string | number, args: unknown[]) => {
  if (typeof message === "number") {
    const definition = global[ApolloErrorMessageHandler]![message];
    if (!message || !definition?.message) return;
    message = definition.message;
  }
  return args.reduce<string>(
    (msg, arg) => msg.replace(/%[sdfo]/, String(arg)),
    String(message)
  );
}) as ErrorMessageHandler & ErrorCodes;
