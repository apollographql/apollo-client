import { TypedDocumentNode, OperationVariables } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { getMarkupFromTree } from "@apollo/client/react/ssr";
import { relayStylePagination } from "@apollo/client/utilities";
import { MockSubscriptionLink, MockLink } from "@apollo/client/testing";

/**
 * This file simulates a library re-exporting functions that wrap Apollo Client
 * functionality or exporting objects created with AC utilities.
 *
 * This is here to ensure that with the introduction of the `exports` field,
 * TypeScript compilation errors on declaration emit are avoided.
 */

export function useWrappedQuery<TData, TVariables extends OperationVariables>(
  query: TypedDocumentNode<TData, TVariables>
) {
  return useQuery(query);
}

export const fieldPolicy = relayStylePagination();
export const mockSubscriptionLink = new MockSubscriptionLink();
export const mockLinkWrapper = (
  ...args: ConstructorParameters<typeof MockLink>
) => new MockLink(...args);

export const mockGetMarkupFromTree = (
  ...options: Parameters<typeof getMarkupFromTree>
) => getMarkupFromTree(...options);
