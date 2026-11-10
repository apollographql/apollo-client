import {
  ApolloClient,
  enableExperimentalFragmentVariables,
  gql,
  NetworkStatus,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { MockLink } from "@apollo/client/testing";
import { ObservableStream } from "@apollo/client/testing/internal";
import { fragmentInfoSymbol } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("uses operation variables in fragments that declare variables", async () => {
  const query = gql`
    query Team($size: Int!) {
      lead {
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      id
      ...UserAvatar
    }

    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { size: 96 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using stream = new ObservableStream(
    client.watchQuery({ query, variables: { size: 96 } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      lead: {
        __typename: "User",
        id: "1",
        avatar: "large.png",
        [fragmentInfoSymbol]: {
          operationVariables: { size: 96 },
          fragments: {
            UserCard: { variables: { size: 96 } },
            UserAvatar: { variables: { size: 96 } },
          },
        },
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
      lead: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
    },
  });
});
