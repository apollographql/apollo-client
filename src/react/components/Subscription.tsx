import PropTypes from 'prop-types';

import { OperationVariables } from '../../core/types';
import { SubscriptionComponentOptions } from './types';
import { useSubscription } from '../hooks/useSubscription';

export function Subscription<TData = any, TVariables = OperationVariables>(
  props: SubscriptionComponentOptions<TData, TVariables>
) {
  const result = useSubscription(props.subscription, props);
  return props.children && result ? props.children(result) : null;
}

export namespace Subscription {
  export const propTypes = {
    subscription: PropTypes.object.isRequired,
    variables: PropTypes.object,
    children: PropTypes.func,
    onSubscriptionData: PropTypes.func,
    onSubscriptionComplete: PropTypes.func,
    shouldResubscribe: PropTypes.oneOfType([PropTypes.func, PropTypes.bool])
  };
}
