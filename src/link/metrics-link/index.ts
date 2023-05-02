import { invariant } from "../../utilities/globals";

import { ApolloLink, Operation, FetchResult, NextLink } from "../core";
import { Observable, Subject, getOperationDefinition, getOperationName } from "../../utilities";
import { ApolloClient, DefaultContext, MetricsEvents } from "../../core";
import { Subscription } from "zen-observable-ts";
import { traceIdSymbol } from "../../core/QueryManager";

interface RequestMetrics {
  endedAt: number;
  responseCode: number;
  finishedAs: "success" | "error";
  errors?: readonly unknown[];
}

interface BaseMetrics {
  operationType: "query" | "mutation" | "subscription";
  operationName: string;
  variables: unknown;
  traceId: string;
  startedAt: number;
}

export type MetricsLinkEvents =
  | ({ type: "cacheHit" } & BaseMetrics)
  | ({ type: "request" } & BaseMetrics & RequestMetrics);

export class MetricsLink extends ApolloLink {
  public metrics = new Subject<MetricsLinkEvents>();
  private clientSubscription: Subscription | undefined;
  public registerClient(client: ApolloClient<any>) {
    if (this.clientSubscription) {
      this.clientSubscription.unsubscribe();
    }
    client.metrics.subscribe(this.onClientRequest);
  }
  private runningRequests = new Map<string, BaseMetrics & Partial<RequestMetrics>>();

  private onClientRequest = (ev: MetricsEvents) => {
    if (ev.type === "request") {
      const { query, cacheHit, context, variables } = ev;
      const operationType = getOperationDefinition(query)?.operation;
      const operationName = getOperationName(query);
      const traceId = getTraceId(context);
      invariant(operationType && operationName, "invalid operation forwarded");
      const baseMetrics = {
        traceId,
        operationType,
        operationName,
        variables,
        startedAt: Date.now(),
      };

      if (cacheHit) {
        this.metrics.next({ type: "cacheHit", ...baseMetrics });
      } else {
        this.runningRequests.set(traceId, baseMetrics);
      }
    }
  };

  request(operation: Operation, forward?: NextLink) {
    invariant(forward, "MetricsLink cannot be the final link.");

    const traceId = getTraceId(operation.getContext());

    const request = forward(operation);
    let initialResponse: FetchResult | undefined;

    return new Observable<FetchResult>((observer) => {
      request.subscribe({
        next: (result) => {
          initialResponse ??= result;
          observer.next(result);
        },
        error: (error) => {
          const { response } = operation.getContext();
          const metrics = this.runningRequests.get(traceId);
          if (metrics) {
            this.runningRequests.delete(traceId);
            this.metrics.next({
              type: "request",
              ...metrics,
              endedAt: Date.now(),
              responseCode: response?.status ?? null,
              finishedAs: "error",
              errors: [error]
            });
          }
          observer.error(error);
        },
        complete: () => {
          const { response } = operation.getContext();
          const metrics = this.runningRequests.get(traceId);
          if (metrics) {
            this.runningRequests.delete(traceId);
            this.metrics.next({
              type: "request",
              ...metrics,
              endedAt: Date.now(),
              responseCode: response.status,
              finishedAs: "success",
              errors: initialResponse!.errors,
            });
          }
          observer.complete();
        },
      });
    });
  }
}

function getTraceId(context: DefaultContext | undefined) {
  const traceId = context?.[traceIdSymbol];
  invariant(traceId, "traceId missing in context");
  return traceId;
}
