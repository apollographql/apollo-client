import { InMemoryCache } from "@apollo/client";
import { ApolloClient, ApolloLink } from "@apollo/client";

new ApolloClient({
  link: ApolloLink.empty(),
  cache: new InMemoryCache(),
});
