import { invariant } from '../../utilities/globals';

import * as React from 'react';

import { ApolloClient } from '../../core';
import { getApolloContext } from './ApolloContext';

export interface ApolloConsumerProps {
  children: (client: ApolloClient<object>) => React.ReactChild | null;
}

export const ApolloConsumer: React.FC<ApolloConsumerProps> = props => {
  const ApolloContext = getApolloContext();
  invariant(ApolloContext, 'Cannot use `ApolloConsumer` in an environment without Context.')
  return (
    <ApolloContext.Consumer>
      {(context: any) => {
        invariant(
          context && context.client,
          'Could not find "client" in the context of ApolloConsumer. ' +
            'Wrap the root component in an <ApolloProvider>.'
        );
        return props.children(context.client);
      }}
    </ApolloContext.Consumer>
  );
};
