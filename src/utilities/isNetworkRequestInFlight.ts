import type { NetworkStatus } from "@apollo/client";

import { isNetworkRequestSettled } from "./isNetworkRequestSettled.js";

/**
 * Returns true if there is currently a network request in flight according to a given network
 * status.
 */
export function isNetworkRequestInFlight(
  networkStatus?: NetworkStatus
): boolean {
  return !isNetworkRequestSettled(networkStatus);
}
