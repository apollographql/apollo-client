import type { DocumentNode } from "graphql";

import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient } from "@apollo/client/core";

import { mockSingleLink } from "./mockLink.js";

export function createMockClient<TData>(
  data: TData,
  query: DocumentNode,
  variables = {}
): ApolloClient {
  return new ApolloClient({
    link: mockSingleLink({
      request: { query, variables },
      result: { data },
    }).setOnError((error) => {
      throw error;
    }),
    cache: new InMemoryCache(),
  });
}
