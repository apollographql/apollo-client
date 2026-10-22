import type { TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  enableExperimentalFragmentVariables,
  gql,
  NetworkStatus,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { MockLink } from "@apollo/client/testing";
import { ObservableStream } from "@apollo/client/testing/internal";

enableExperimentalFragmentVariables();

interface User {
  __typename: "User";
  id: string;
  bestFriend: { __typename: "User"; id: string; avatar: string };
}

interface TeamData {
  member: User;
  lead: User;
}

test("emits a previously read result written under a different fragment argument scope", async () => {
  // `member` is first so the write reaches User:3 through the `member` scope
  // before the `lead` scope.
  const query: TypedDocumentNode<TeamData> = gql`
    query Team {
      member {
        ...UserCard(size: 32)
      }
      lead {
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      id
      bestFriend {
        id
        avatar(size: $size)
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            member: {
              __typename: "User",
              id: "2",
              bestFriend: { __typename: "User", id: "4", avatar: "small.png" },
            },
            lead: {
              __typename: "User",
              id: "1",
              bestFriend: {
                __typename: "User",
                id: "3",
                avatar: "default.png",
              },
            },
          },
        },
      },
    ]),
  });

  using stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      member: {
        __typename: "User",
        id: "2",
        bestFriend: { __typename: "User", id: "4", avatar: "small.png" },
      },
      lead: {
        __typename: "User",
        id: "1",
        bestFriend: { __typename: "User", id: "3", avatar: "default.png" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  client.cache.updateQuery({ query }, (data) => ({
    ...data!,
    member: { ...data!.member, bestFriend: data!.lead.bestFriend },
  }));

  await expect(stream).toEmitTypedValue({
    data: {
      member: {
        __typename: "User",
        id: "2",
        bestFriend: { __typename: "User", id: "3", avatar: "default.png" },
      },
      lead: {
        __typename: "User",
        id: "1",
        bestFriend: { __typename: "User", id: "3", avatar: "default.png" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      member: { __ref: "User:2" },
      lead: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      bestFriend: { __ref: "User:3" },
    },
    "User:2": {
      __typename: "User",
      id: "2",
      bestFriend: { __ref: "User:3" },
    },
    "User:3": {
      __typename: "User",
      id: "3",
      avatar: "default.png",
      'avatar({"size":32})': "default.png",
    },
    "User:4": {
      __typename: "User",
      id: "4",
      'avatar({"size":32})': "small.png",
    },
  });
});
