import type { ApolloContext, ApolloLink, GraphQLRequest } from "@apollo/client";
import { ApolloClient, execute, InMemoryCache } from "@apollo/client";
import { createOperation } from "@apollo/client/link/utils";

function createDefaultApolloContext() {
  return { client: new ApolloClient({ cache: new InMemoryCache() }) };
}

export function executeWithDefaultContext(
  link: ApolloLink,
  operation: GraphQLRequest,
  apolloContext: ApolloContext = createDefaultApolloContext()
) {
  return execute(link, operation, apolloContext);
}

export function createOperationWithDefaultContext(
  context: any,
  operation: GraphQLRequest,
  apolloContext: ApolloContext = createDefaultApolloContext()
) {
  return createOperation(context, operation, apolloContext);
}
