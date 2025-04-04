import type { DocumentNode } from "graphql";

import { ApolloClient } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";

import { mockSingleLink } from "./mockLink.js";

// TODO: Deprecate this function
export function createMockClient<TData>(
  data: TData,
  query: DocumentNode,
  variables = {}
): ApolloClient {
  return new ApolloClient({
    link: mockSingleLink({
      request: { query, variables },
      result: { data },
    }),
    cache: new InMemoryCache(),
  });
}
