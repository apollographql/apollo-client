import type { ErrorCodes } from "../invariantErrorCodes.js";
import { version } from "../version.js";

// This is duplicated between `@apollo/client/dev` and `@apollo/client/utilities/invariant` to prevent circular references.
export const ApolloErrorMessageHandler = Symbol.for(
  "ApolloErrorMessageHandler_" + version
);
declare global {
  interface Window {
    [ApolloErrorMessageHandler]?: {
      (message: string | number, args: string[]): string | undefined;
    } & ErrorCodes;
  }
}
