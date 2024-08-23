import gql from "graphql-tag";
import { ApolloClient, InMemoryCache } from "../../../core";
import { useQuery, ApolloProvider } from "../../../react";
import { profileHook } from "../../../testing/internal";
import { render } from "@testing-library/react";
import * as React from "react";

it("flips to `loading: true`, then `loading: false` on an empty cache when using `cache-only`", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const client = new ApolloClient({ cache: new InMemoryCache() });
  const UseQuery = profileHook(() =>
    useQuery(query, { fetchPolicy: "cache-only" })
  );
  render(<UseQuery />, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  });
  {
    const snapshot = await UseQuery.takeSnapshot();
    expect(snapshot.loading).toBe(true);
    expect(snapshot.data).toBe(undefined);
  }
  {
    const snapshot = await UseQuery.takeSnapshot();
    expect(snapshot.loading).toBe(false);
    expect(snapshot.data).toBe(undefined);
  }
  expect(UseQuery).not.toRerender();
});
