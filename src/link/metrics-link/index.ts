import { invariant } from "../../utilities/globals";

import { ApolloLink, Operation, FetchResult, NextLink } from "../core";
import { Observable, Subject, getOperationDefinition, getOperationName } from "../../utilities";
import { ApolloClient, DefaultContext, MetricsEvents } from "../../core";
import { Subscription } from "zen-observable-ts";
import { traceIdSymbol } from "../../core/QueryManager";

interface RequestMetrics {
  endedAt: number;
  responseCode: number | null;
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

type ExtractInfoData =
  | {
      type: "cacheHit";
      context: DefaultContext;
    }
  | {
      type: "request";
      context: DefaultContext;
      operation: Operation;
    };

type ExtractInfo<AdditionalMetrics extends Record<string, unknown>> = (
  data: ExtractInfoData
) => AdditionalMetrics;

type MetricsLinkOptions<AdditionalMetrics extends Record<string, unknown>> =
  keyof AdditionalMetrics extends never
    ? {
        extractInfo?: ExtractInfo<AdditionalMetrics>;
      }
    : {
        extractInfo: ExtractInfo<AdditionalMetrics>;
      };

export class MetricsLink<AdditionalMetrics extends Record<string, unknown> = {}> extends ApolloLink {
  public metrics = new Subject<MetricsLinkEvents>();
  private clientSubscription: Subscription | undefined;
  private runningRequests = new Map<string, BaseMetrics & Partial<RequestMetrics>>();
  private extractInfo?: ExtractInfo<AdditionalMetrics>;

  constructor(options: MetricsLinkOptions<AdditionalMetrics>) {
    super();
    if (options && "extractInfo" in options) {
      this.extractInfo = options.extractInfo;
    }
  }

  public registerClient(client: ApolloClient<any>) {
    if (this.clientSubscription) {
      this.clientSubscription.unsubscribe();
    }
    client.metrics.subscribe(this.onClientRequest);
  }
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
        const extractedInfo = this.extractInfo?.({
          type: "cacheHit",
          context,
        });
        this.metrics.next({ ...extractedInfo, type: "cacheHit", ...baseMetrics });
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

    const emitRequestMetric = (dynamicData: Omit<RequestMetrics, "endedAt">) => {
      const metrics = this.runningRequests.get(traceId);
      if (!metrics) return;
      this.runningRequests.delete(traceId);
      const extractedInfo = this.extractInfo?.({
        type: "request",
        context: operation.getContext(),
        operation,
      });
      this.metrics.next({
        ...extractedInfo,
        type: "request",
        ...metrics,
        endedAt: Date.now(),
        ...dynamicData,
      });
    };

    return new Observable<FetchResult>((observer) => {
      request.subscribe({
        next: (result) => {
          initialResponse ??= result;
          observer.next(result);
        },
        error: (error) => {
          const { response } = operation.getContext();
          emitRequestMetric({
            responseCode: response?.status ?? null,
            finishedAs: "error",
            errors: [error],
          });
          observer.error(error);
        },
        complete: () => {
          const { response } = operation.getContext();
          emitRequestMetric({
            responseCode: response.status,
            finishedAs: "success",
            errors: initialResponse!.errors,
          });
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
