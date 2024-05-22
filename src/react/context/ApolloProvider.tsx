import { invariant } from "../../utilities/globals/index.js";

import * as React from "rehackt";
import type * as ReactTypes from "react";

import type { ApolloClient } from "../../core/index.js";
import { getApolloContext } from "./ApolloContext.js";

export interface ApolloProviderProps<TCache> {
  client: ApolloClient<TCache>;
  children: ReactTypes.ReactNode | ReactTypes.ReactNode[] | null;
}

export const ApolloProvider: ReactTypes.FC<ApolloProviderProps<any>> = ({
  client,
  children,
}) => {
  const ApolloContext = getApolloContext();
  const parentContext = React.useContext(ApolloContext);

  const context = React.useMemo(() => {
    return {
      ...parentContext,
      client: client || parentContext.client,
    };
  }, [parentContext, client]);

  invariant(
    context.client,
    "ApolloProvider was not passed a client instance. Make " +
      'sure you pass in your client via the "client" prop.'
  );

  return (
    <ApolloContext.Provider value={context}>{children}</ApolloContext.Provider>
  );
};
