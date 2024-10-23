import type { Observable } from "zen-observable-ts";
import type { FetchResult, NextLink, Operation } from "../core/index.js";
import { ApolloLink } from "../core/index.js";

export class DevtoolsLink extends ApolloLink {
  public request(
    operation: Operation,
    forward: NextLink
  ): Observable<FetchResult> | null {
    return forward(operation);
  }
}
