import { of } from "rxjs";

import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { getSuspenseCache } from "@apollo/client/react/internal";
import { setupSimpleCase } from "@apollo/client/testing/internal";

test("QueryRef is removed from SuspenseCache on store reset", () => {
  const { query } = setupSimpleCase();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      return of({ data: { greeting: "Hello" } });
    }),
  });
  const cache = getSuspenseCache(client);
  const get = () =>
    cache.getQueryRef([query, "{}"], () =>
      client.watchQuery<any, any>({ query })
    );
  const queryRef = get();

  // should return the same `queryRef` from the cache
  expect(get()).toBe(queryRef);

  client.stop();
  // queryRef should have been removed from the cache so we get a new one
  expect(get()).not.toBe(queryRef);
});
