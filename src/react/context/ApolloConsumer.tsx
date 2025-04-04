import type * as ReactTypes from "react";
import * as React from "react";

import type { ApolloClient } from "@apollo/client/core";
import { invariant } from "@apollo/client/utilities/invariant";

import { getApolloContext } from "./ApolloContext.js";

declare namespace ApolloConsumer {
  export interface Props {
    children: (client: ApolloClient) => ReactTypes.ReactNode;
  }
}

export const ApolloConsumer: ReactTypes.FC<ApolloConsumer.Props> = (props) => {
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
