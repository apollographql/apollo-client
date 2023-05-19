import type {ErrorCodes} from '../invariantErrorCodes';
import { global } from '../utilities/globals';
import {ApolloErrorMessageHandler} from '../utilities/globals/invariantWrappers';

export function loadErrorMessageHandler(...errorCodes: ErrorCodes[]){
  if (!global[ApolloErrorMessageHandler]) {
    global[ApolloErrorMessageHandler] = handler as typeof handler & ErrorCodes;
  }

  for (const codes of errorCodes) {
    Object.assign(global[ApolloErrorMessageHandler], codes)  
  }

  function handler(message: string | number, args: unknown[]) {
    if (typeof message === "number") {
      const definition = global[ApolloErrorMessageHandler]![message];
      if (!message || !definition.message) return;
      message = definition.message;
    }
    return args.reduce<string>((msg, arg) => msg.replace("%s", String(arg)), String(message));
  }
}
