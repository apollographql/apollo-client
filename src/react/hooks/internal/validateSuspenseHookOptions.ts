import type {
  OperationVariables,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "@apollo/client";
import { invariant } from "@apollo/client/utilities/invariant";

export function validateSuspenseHookOptions<
  TData,
  TVariables extends OperationVariables,
>(options: WatchQueryOptions<TVariables, TData>) {
  const { fetchPolicy, returnPartialData } = options;

  validateFetchPolicy(fetchPolicy);
  validatePartialDataReturn(fetchPolicy, returnPartialData);
}

function validateFetchPolicy(
  fetchPolicy: WatchQueryFetchPolicy = "cache-first"
) {
  const supportedFetchPolicies: WatchQueryFetchPolicy[] = [
    "cache-first",
    "network-only",
    "no-cache",
    "cache-and-network",
  ];

  invariant(
    supportedFetchPolicies.includes(fetchPolicy),
    `The fetch policy \`%s\` is not supported with suspense.`,
    fetchPolicy
  );
}

function validatePartialDataReturn(
  fetchPolicy: WatchQueryFetchPolicy | undefined,
  returnPartialData: boolean | undefined
) {
  if (fetchPolicy === "no-cache" && returnPartialData) {
    invariant.warn(
      "Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy."
    );
  }
}
