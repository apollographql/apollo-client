import type { ErrorCodes } from "../invariantErrorCodes.js";
import { global } from "../utilities/globals/index.js";
import { ApolloErrorMessageHandler } from "../utilities/globals/invariantWrappers.js";

export function loadErrorMessageHandler(...errorCodes: ErrorCodes[]) {
  if (!global[ApolloErrorMessageHandler]) {
    global[ApolloErrorMessageHandler] = handler as typeof handler & ErrorCodes;
  }

  for (const codes of errorCodes) {
    Object.assign(global[ApolloErrorMessageHandler], codes);
  }

  return global[ApolloErrorMessageHandler];

  function handler(message: string | number, args: unknown[]) {
    if (typeof message === "number") {
      const definition = global[ApolloErrorMessageHandler]![message];
      if (!message || !definition.message) return;
      message = definition.message;
    }
    return args.reduce<string>(
      (msg, arg) => msg.replace("%s", String(arg)),
      String(message)
    );
  }
}
