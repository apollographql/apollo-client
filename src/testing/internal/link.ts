import type { GraphQLRequest } from "@apollo/client";
import { ApolloClient, execute, InMemoryCache } from "@apollo/client";
import type { ExecuteContext } from "@apollo/client/link";
import { ApolloLink } from "@apollo/client/link";
import { createOperation } from "@apollo/client/link/utils";

function createDefaultExecuteContext() {
  return {
    client: new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    }),
  };
}

export function executeWithDefaultContext(
  link: ApolloLink,
  request: GraphQLRequest,
  context: ExecuteContext = createDefaultExecuteContext()
) {
  return execute(link, request, context);
}

export function createOperationWithDefaultContext(
  request: GraphQLRequest,
  executeContext: ExecuteContext = createDefaultExecuteContext()
) {
  return createOperation(request, executeContext);
}
