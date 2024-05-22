import * as PropTypes from "prop-types";
import type * as ReactTypes from "react";

import type { OperationVariables } from "../../core/index.js";
import type { SubscriptionComponentOptions } from "./types.js";
import { useSubscription } from "../hooks/index.js";

/**
 * @deprecated
 * Official support for React Apollo render prop components ended in March 2020.
 * This library is still included in the `@apollo/client` package,
 * but it no longer receives feature updates or bug fixes.
 */
export function Subscription<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  props: SubscriptionComponentOptions<TData, TVariables>
): ReactTypes.JSX.Element | null {
  const result = useSubscription(props.subscription, props);
  return props.children && result ? props.children(result) : null;
}

export interface Subscription<TData, TVariables extends OperationVariables> {
  propTypes: PropTypes.InferProps<
    SubscriptionComponentOptions<TData, TVariables>
  >;
}

Subscription.propTypes = {
  subscription: PropTypes.object.isRequired,
  variables: PropTypes.object,
  children: PropTypes.func,
  onSubscriptionData: PropTypes.func,
  onData: PropTypes.func,
  onSubscriptionComplete: PropTypes.func,
  onComplete: PropTypes.func,
  shouldResubscribe: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
} as Subscription<any, any>["propTypes"];
