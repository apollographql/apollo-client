import type * as ReactTypes from "react";
import * as React from "rehackt";

import type { ApolloClient } from "@apollo/client/core";
import { invariant } from "@apollo/client/utilities/invariant";

import { getApolloContext } from "./ApolloContext.js";

export interface ApolloConsumerProps {
  children: (client: ApolloClient<object>) => ReactTypes.ReactNode;
}

export const ApolloConsumer: ReactTypes.FC<ApolloConsumerProps> = (props) => {
  const ApolloContext = getApolloContext();
  return (
    <ApolloContext.Consumer>
      {(context: any) => {
        invariant(
          context && context.client,
          'Could not find "client" in the context of ApolloConsumer. ' +
            "Wrap the root component in an <ApolloProvider>."
        );
        return props.children(context.client);
      }}
    </ApolloContext.Consumer>
  );
};
