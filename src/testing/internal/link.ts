import { ApolloClient, execute, InMemoryCache } from "@apollo/client";
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
  request: ApolloLink.Request,
  context: ApolloLink.ExecuteContext = createDefaultExecuteContext()
) {
  return execute(link, request, context);
}

export function createOperationWithDefaultContext(
  request: ApolloLink.Request,
  executeContext: ApolloLink.ExecuteContext = createDefaultExecuteContext()
) {
  return createOperation(request, executeContext);
}
