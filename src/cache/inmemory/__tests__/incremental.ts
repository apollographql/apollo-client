import { ApolloClient, ApolloLink } from "@apollo/client";
import {
  DefaultStrategy,
  Defer20220824,
  InMemoryCache,
} from "@apollo/client/cache";

test("default strategy", () => {
  const client = new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
  });
});

test("defer 20220804 strategy", () => {
  const client = new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache({ incrementalStrategy: new Defer20220824() }),
  });
});
