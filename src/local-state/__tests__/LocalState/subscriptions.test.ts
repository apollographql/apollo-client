import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloLink } from "@apollo/client/link";
import { LocalState } from "@apollo/client/local-state";
import { InvariantError } from "@apollo/client/utilities/invariant";

import { gql } from "./testUtils.js";

test("throws when given a subscription with no client fields", async () => {
  const subscription = gql`
    subscription {
      field
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document: subscription,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { field: 1 } },
    })
  ).rejects.toEqual(
    new InvariantError("Expected document to contain `@client` fields.")
  );
});

test("adds @client fields with subscription results", async () => {
  const subscription = gql`
    subscription {
      field
      count @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  let subCounter = 0;
  const localState = new LocalState({
    resolvers: {
      Subscription: {
        count: () => {
          subCounter += 1;
          return subCounter;
        },
      },
    },
  });

  await expect(
    localState.execute({
      document: subscription,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { field: 1 } },
    })
  ).resolves.toStrictEqualTyped({
    data: { field: 1, count: 1 },
  });

  await expect(
    localState.execute({
      document: subscription,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { field: 2 } },
    })
  ).resolves.toStrictEqualTyped({
    data: { field: 2, count: 2 },
  });
});
