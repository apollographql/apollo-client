import {
  ApolloClient,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
} from "@apollo/client";
import { MockLink } from "@apollo/client/testing";

test("uses defaultOptions from `query` key", async () => {
  const query = gql`
    query {
      greeting
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data: { greeting: null }, errors: [{ message: "Oops" }] },
      },
    ]),
    defaultOptions: {
      query: {
        errorPolicy: "all",
      },
    },
  });

  await expect(client.query({ query })).resolves.toStrictEqualTyped({
    data: { greeting: null },
    error: new CombinedGraphQLErrors({
      data: { greeting: null },
      errors: [{ message: "Oops" }],
    }),
  });
});

test("does not use defaultOptions from `watchQuery` key", async () => {
  const query = gql`
    query {
      greeting
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data: { greeting: null }, errors: [{ message: "Oops" }] },
      },
    ]),
    defaultOptions: {
      watchQuery: {
        errorPolicy: "all",
      },
    },
  });

  await expect(client.query({ query })).rejects.toThrow(
    new CombinedGraphQLErrors({
      data: { greeting: null },
      errors: [{ message: "Oops" }],
    })
  );
});
