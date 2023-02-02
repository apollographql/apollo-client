import * as PropTypes from 'prop-types';

import { OperationVariables } from '../../core';
import { SubscriptionComponentOptions } from './types';
import { useSubscription } from '../hooks';

export function Subscription<TData = any, TVariables extends OperationVariables = OperationVariables>(
  props: SubscriptionComponentOptions<TData, TVariables>
) {
  const result = useSubscription(props.subscription, props);
  return props.children && result ? props.children(result) : null;
}

export interface Subscription<TData, TVariables extends OperationVariables> {
  propTypes: PropTypes.InferProps<SubscriptionComponentOptions<TData, TVariables>>;
}

Subscription.propTypes = {
  subscription: PropTypes.object.isRequired,
  variables: PropTypes.object,
  children: PropTypes.func,
  onSubscriptionData: PropTypes.func,
  onData: PropTypes.func,
  onSubscriptionComplete: PropTypes.func,
  onComplete: PropTypes.func,
  shouldResubscribe: PropTypes.oneOfType([PropTypes.func, PropTypes.bool])
} as Subscription<any, any>["propTypes"];
