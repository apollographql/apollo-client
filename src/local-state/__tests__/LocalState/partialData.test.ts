import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";
import { spyOnConsole } from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("omits field and does not warn if resolver not defined when returnPartialData is true", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      user {
        id
        isLoggedIn @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { user: { __typename: "User", id: 1 } } },
      returnPartialData: true,
    })
  ).resolves.toStrictEqualTyped({
    data: { user: { __typename: "User", id: 1 } },
  });

  expect(console.warn).not.toHaveBeenCalled();
});

test("omits client fields without cached values when running forced resolvers with returnPartialData: true", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      user {
        id
        name @client
        isLoggedIn @client(always: true)
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  let nameCount = 0;
  let isLoggedInCount = 0;
  const localState = new LocalState({
    resolvers: {
      User: {
        name: () => {
          nameCount++;
          return "John Smith";
        },
        isLoggedIn: () => {
          isLoggedInCount++;
          return true;
        },
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { user: { __typename: "User", id: 1 } } },
      returnPartialData: true,
      onlyRunForcedResolvers: true,
    })
  ).resolves.toStrictEqualTyped({
    // Note: name is omitted because we are only running forced resolvers and
    // have no cached value for name
    data: { user: { __typename: "User", id: 1, isLoggedIn: true } },
  });

  expect(console.warn).not.toHaveBeenCalled();
  expect(nameCount).toBe(0);
  expect(isLoggedInCount).toBe(1);
});
