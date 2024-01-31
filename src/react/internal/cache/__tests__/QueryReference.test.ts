import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
} from "../../../../core";
import { setupSimpleCase } from "../../../../testing/internal";
import { InternalQueryReference } from "../QueryReference";

test("kicks off request immediately when created", async () => {
  const { query } = setupSimpleCase();
  let fetchCount = 0;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      fetchCount++;
      return Observable.of({ data: { greeting: "Hello" } });
    }),
  });

  const observable = client.watchQuery({ query });

  expect(fetchCount).toBe(0);
  new InternalQueryReference(observable, {});
  expect(fetchCount).toBe(1);
});
