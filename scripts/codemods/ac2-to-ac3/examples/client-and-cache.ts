import Client from "apollo-client";
import { InMemoryCache, InMemoryCacheConfig } from "apollo-cache-inmemory";
import gql from "graphql-tag";

const client = new Client({
  cache: new InMemoryCache({} as InMemoryCacheConfig),
});

client.query({
  query: gql`query { __typename }`,
});
