import { fallbackHttpConfig } from "../../link/http/selectHttpOptionsAndBody.js";

export type CreateMultipartSubscriptionOptions = {
  fetch?: WindowOrWorkerGlobalScope["fetch"];
  headers?: Record<string, string>;
};

export function generateOptionsForMultipartSubscription(
  headers: Record<string, string>
) {
  const options: { headers: Record<string, any>; body?: string } = {
    ...fallbackHttpConfig.options,
    headers: {
      ...(headers || {}),
      ...fallbackHttpConfig.headers,
      accept:
        "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json",
    },
  };
  return options;
}
