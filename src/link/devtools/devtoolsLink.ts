import type { Observable } from "zen-observable-ts";
import type { FetchResult, NextLink, Operation } from "../core/index.js";
import { ApolloLink } from "../core/index.js";
import type { DefaultContext } from "../../core/types.js";
import { createDevtoolsActor } from "./messages.js";
import type { DevtoolsActor } from "./messages.js";

export class DevtoolsLink extends ApolloLink {
  private debugConnectorsRequests = false;
  private actor: DevtoolsActor;

  constructor() {
    super();

    this.actor = createDevtoolsActor();
    this.subscribeToDevtoolsMessages();
  }

  public request(
    operation: Operation,
    forward: NextLink
  ): Observable<FetchResult> | null {
    if (this.debugConnectorsRequests) {
      operation.setContext((context: DefaultContext) => ({
        headers: {
          ...context.headers,
          "Apollo-Connectors-Debugging": "true",
        },
      }));
    }

    return forward(operation);
  }

  private subscribeToDevtoolsMessages() {
    this.actor.on("toggleConnectorsDebugging", ({ enabled }) => {
      this.debugConnectorsRequests = enabled;
    });
  }
}
