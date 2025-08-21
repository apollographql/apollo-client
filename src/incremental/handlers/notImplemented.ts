import type { ApolloLink } from "@apollo/client/link";
import type { HKT } from "@apollo/client/utilities";
import { hasDirectives } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import type { Incremental } from "../types.js";

export declare namespace NotImplementedHandler {
  interface NotImplementedResult extends HKT {
    arg1: unknown; // TData
    arg2: unknown; // TExtensions
    return: never;
  }
  export interface TypeOverrides {
    AdditionalApolloLinkResultTypes: NotImplementedResult;
  }
}

export class NotImplementedHandler implements Incremental.Handler<never> {
  isIncrementalResult(_: any): _ is never {
    return false;
  }
  prepareRequest(request: ApolloLink.Request) {
    invariant(
      !hasDirectives(["defer"], request.query),
      "`@defer` is not supported without specifying an incremental handler. Please pass a handler as the `incrementalHandler` option to the `ApolloClient` constructor."
    );

    return request;
  }
  extractErrors() {}
  // This code path can never be reached, so we won't implement it.
  startRequest = undefined as any;
}
