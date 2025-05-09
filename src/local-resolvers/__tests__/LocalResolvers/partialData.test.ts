import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalResolvers } from "@apollo/client/local-resolvers";
import { spyOnConsole } from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("sets field to null and warns if resolver not defined when returnPartialData is false", async () => {
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

  const localResolvers = new LocalResolvers();

  await expect(
    localResolvers.execute({
      document,
      client,
      context: {},
      remoteResult: { data: { user: { __typename: "User", id: 1 } } },
      returnPartialData: false,
    })
  ).resolves.toStrictEqualTyped({
    data: { user: { __typename: "User", id: 1, isLoggedIn: null } },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Could not find a resolver for the '%s' field. The field value has been set to `null`.",
    "User.isLoggedIn"
  );
});

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

  const localResolvers = new LocalResolvers();

  await expect(
    localResolvers.execute({
      document,
      client,
      context: {},
      remoteResult: { data: { user: { __typename: "User", id: 1 } } },
      returnPartialData: true,
    })
  ).resolves.toStrictEqualTyped({
    data: { user: { __typename: "User", id: 1 } },
  });

  expect(console.warn).not.toHaveBeenCalled();
});
