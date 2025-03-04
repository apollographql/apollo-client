import { invariant } from "@apollo/client/utilities/globals";

import * as React from "rehackt";
import type * as ReactTypes from "react";

import type { ApolloClient } from "@apollo/client/core";
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
