import type { DocumentNode } from "graphql";

import { ApolloClient } from "../../../core/index.js";
import type { NormalizedCacheObject } from "../../../cache/index.js";
import { InMemoryCache } from "../../../cache/index.js";
import { mockSingleLink } from "./mockLink.js";

/**
 * @deprecated `createMockClient` will be removed in Apollo Client 4.0. Please
 * instantiate a client using `new ApolloClient()` using a `MockLink`.
 */
export function createMockClient<TData>(
  data: TData,
  query: DocumentNode,
  variables = {}
): ApolloClient<NormalizedCacheObject> {
  return new ApolloClient({
    link: mockSingleLink({
      request: { query, variables },
      result: { data },
    }).setOnError((error) => {
      throw error;
    }),
    cache: new InMemoryCache({ addTypename: false }),
  });
}
