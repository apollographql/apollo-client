import {
  ApolloClient,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { MockLink } from "@apollo/client/testing";
import { fragmentInfoSymbol } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("binds different fragment arguments at different paths", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(size: 96)
      }
      members {
        ...UserCard(size: 32)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "lead.png" },
            members: [{ __typename: "User", id: "2", avatar: "member.png" }],
          },
        },
      },
    ]),
  });

  await expect(client.query({ query })).resolves.toStrictEqualTyped({
    data: {
      lead: {
        __typename: "User",
        id: "1",
        avatar: "lead.png",
        [fragmentInfoSymbol]: {
          fragments: { UserCard: { variables: { size: 96 } } },
        },
      },
      members: [
        {
          __typename: "User",
          id: "2",
          avatar: "member.png",
          [fragmentInfoSymbol]: {
            fragments: { UserCard: { variables: { size: 32 } } },
          },
        },
      ],
    },
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      lead: { __ref: "User:1" },
      members: [{ __ref: "User:2" }],
    },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "lead.png",
    },
    "User:2": {
      __typename: "User",
      id: "2",
      'avatar({"size":32})': "member.png",
    },
  });
});

test("passes an operation variable through a fragment spread", async () => {
  const query = gql`
    query Team($n: Int!) {
      lead {
        ...UserCard(size: $n)
      }
    }

    fragment UserCard($size: Int!) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { n: 96 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "lead.png" },
          },
        },
      },
    ]),
  });

  await expect(
    client.query({ query, variables: { n: 96 } })
  ).resolves.toStrictEqualTyped({
    data: {
      lead: {
        __typename: "User",
        id: "1",
        avatar: "lead.png",
        [fragmentInfoSymbol]: {
          fragments: { UserCard: { variables: { n: 96, size: 96 } } },
        },
      },
    },
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      lead: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "lead.png",
    },
  });
});

test("reads bound fragment arguments from the cache without a network request", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(size: 96)
      }
      members {
        ...UserCard(size: 32)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
  });

  client.writeQuery({
    query,
    data: {
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
      members: [{ __typename: "User", id: "2", avatar: "member.png" }],
    },
  });

  await expect(client.query({ query })).resolves.toStrictEqualTyped({
    data: {
      lead: {
        __typename: "User",
        id: "1",
        avatar: "lead.png",
        [fragmentInfoSymbol]: {
          fragments: { UserCard: { variables: { size: 96 } } },
        },
      },
      members: [
        {
          __typename: "User",
          id: "2",
          avatar: "member.png",
          [fragmentInfoSymbol]: {
            fragments: { UserCard: { variables: { size: 32 } } },
          },
        },
      ],
    },
  });
});
