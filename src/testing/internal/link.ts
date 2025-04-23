import type { ApolloLink, GraphQLRequest } from "@apollo/client";
import { ApolloClient, execute, InMemoryCache } from "@apollo/client";
import type { ExecuteContext } from "@apollo/client/link/core";
import { createOperation } from "@apollo/client/link/utils";

function createDefaultExecuteContext() {
  return { client: new ApolloClient({ cache: new InMemoryCache() }) };
}

export function executeWithDefaultContext(
  link: ApolloLink,
  operation: GraphQLRequest,
  context: ExecuteContext = createDefaultExecuteContext()
) {
  return execute(link, operation, context);
}

export function createOperationWithDefaultContext(
  context: any,
  operation: GraphQLRequest,
  executeContext: ExecuteContext = createDefaultExecuteContext()
) {
  return createOperation(context, operation, executeContext);
}
