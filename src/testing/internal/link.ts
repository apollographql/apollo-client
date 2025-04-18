import type { ApolloContext, ApolloLink, GraphQLRequest } from "@apollo/client";
import { ApolloClient, execute, InMemoryCache } from "@apollo/client";

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
