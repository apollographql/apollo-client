import type { GraphQLRequest } from "@apollo/client";
import { hasDirectives } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import type { Incremental } from "../types.js";

export class NotImplementedHandler implements Incremental.Handler<never> {
  isIncrementalResult(_: any): _ is never {
    return false;
  }
  prepareRequest(request: GraphQLRequest) {
    invariant(
      !hasDirectives(["defer"], request.query),
      "`@defer` is not supported without specifying an incremental handler. Please pass one as the `incrementalHandler` option to `ApolloClient`."
    );

    return request;
  }
  extractErrors() {}
  // This code path can never be reached, so we won't implement it.
  startRequest = undefined as any;
}
