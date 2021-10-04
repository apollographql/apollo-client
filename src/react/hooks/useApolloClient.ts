import { invariant } from '../../utilities/globals';

import * as React from 'react';

import { ApolloClient } from '../../core';
import { getApolloContext } from '../context';

export function useApolloClient(): ApolloClient<object> {
  const { client } = React.useContext(getApolloContext());
  invariant(
    client,
    'No Apollo Client instance can be found. Please ensure that you ' +
      'have called `ApolloProvider` higher up in your tree.'
  );
  return client!;
}
