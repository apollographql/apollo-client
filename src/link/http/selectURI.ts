import type { ApolloLink } from "@apollo/client/link";

export const selectURI = (
  operation: ApolloLink.Operation,
  fallbackURI?: string | ((operation: ApolloLink.Operation) => string)
) => {
  const context = operation.getContext();
  const contextURI = context.uri;

  if (contextURI) {
    return contextURI;
  } else if (typeof fallbackURI === "function") {
    return fallbackURI(operation);
  } else {
    return (fallbackURI as string) || "/graphql";
  }
};
