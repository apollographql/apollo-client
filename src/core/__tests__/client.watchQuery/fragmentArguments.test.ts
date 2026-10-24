import type { DocumentNode } from "graphql";
import { delay, of } from "rxjs";

import type { TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
  NetworkStatus,
} from "@apollo/client";
import { createFragmentRegistry, InMemoryCache } from "@apollo/client/cache";
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";
import { LocalState } from "@apollo/client/local-state";
import { MockLink } from "@apollo/client/testing";
import {
  markAsStreaming,
  mockDeferStreamGraphQL17Alpha9,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

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

test("binds a fragment argument", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(size: 96)
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
            lead: { __typename: "User", id: "1", avatar: "large.png" },
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
      lead: { __typename: "User", id: "1", avatar: "large.png" },
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
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
      members: [{ __typename: "User", id: "2", avatar: "member.png" }],
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

test("applies fragment argument defaults when the spread omits an argument", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard
      }
    }

    fragment UserCard($size: Int = 48) on User {
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
            lead: { __typename: "User", id: "1", avatar: "default.png" },
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
      lead: { __typename: "User", id: "1", avatar: "default.png" },
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
      'avatar({"size":48})': "default.png",
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

  using stream = new ObservableStream(
    client.watchQuery({ query, variables: { n: 96 } })
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
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
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
      'avatar({"size":96})': "lead.png",
    },
  });
});

test("shadows an operation variable with a fragment argument of the same name", async () => {
  const query = gql`
    query Team($size: Int!) {
      lead {
        photo(size: $size)
        ...UserCard(size: 96)
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
        request: { query, variables: { size: 32 } },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              photo: "photo-32.png",
              avatar: "avatar-96.png",
            },
          },
        },
      },
    ]),
  });

  using stream = new ObservableStream(
    client.watchQuery({ query, variables: { size: 32 } })
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
        photo: "photo-32.png",
        avatar: "avatar-96.png",
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
      'photo({"size":32})': "photo-32.png",
      'avatar({"size":96})': "avatar-96.png",
    },
  });
});

test("passes a fragment argument through a nested fragment spread", async () => {
  const query = gql`
    query Team {
      lead {
        ...Outer(size: 96)
      }
    }

    fragment Outer($size: Int!) on User {
      ...Inner(size: $size)
    }

    fragment Inner($size: Int!) on User {
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
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
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
      'avatar({"size":96})': "lead.png",
    },
  });
});

test("does not leak a fragment argument into a child fragment that does not declare it", async () => {
  const query = gql`
    query Example($x: Int) {
      user {
        ...Foo(x: 1)
      }
    }

    fragment Foo($x: Int!) on User {
      id
      fooValue: value(x: $x)
      ...Bar
    }

    fragment Bar on User {
      value(x: $x)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { x: 99 } },
        result: {
          data: {
            user: { __typename: "User", id: "1", fooValue: 1, value: 99 },
          },
        },
      },
    ]),
  });

  using stream = new ObservableStream(
    client.watchQuery({ query, variables: { x: 99 } })
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
      user: { __typename: "User", id: "1", fooValue: 1, value: 99 },
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
      user: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      'value({"x":1})': 1,
      'value({"x":99})': 99,
    },
  });
});

test("uses a fragment argument in @include", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(includeAvatar: true)
      }
      member {
        ...UserCard(includeAvatar: false)
      }
    }

    fragment UserCard($includeAvatar: Boolean!) on User {
      id
      avatar @include(if: $includeAvatar)
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
            member: { __typename: "User", id: "2", avatar: "member.png" },
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
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
      member: { __typename: "User", id: "2" },
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
      member: { __ref: "User:2" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      avatar: "lead.png",
    },
    "User:2": {
      __typename: "User",
      id: "2",
    },
  });
});

test("uses fragment arguments in child selection sets", async () => {
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
      friends {
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
            lead: {
              __typename: "User",
              id: "1",
              friends: [{ __typename: "User", id: "3", avatar: "large.png" }],
            },
            members: [
              {
                __typename: "User",
                id: "2",
                friends: [{ __typename: "User", id: "4", avatar: "small.png" }],
              },
            ],
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
      lead: {
        __typename: "User",
        id: "1",
        friends: [{ __typename: "User", id: "3", avatar: "large.png" }],
      },
      members: [
        {
          __typename: "User",
          id: "2",
          friends: [{ __typename: "User", id: "4", avatar: "small.png" }],
        },
      ],
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
      members: [{ __ref: "User:2" }],
    },
    "User:1": {
      __typename: "User",
      id: "1",
      friends: [{ __ref: "User:3" }],
    },
    "User:2": {
      __typename: "User",
      id: "2",
      friends: [{ __ref: "User:4" }],
    },
    "User:3": {
      __typename: "User",
      id: "3",
      'avatar({"size":96})': "large.png",
    },
    "User:4": {
      __typename: "User",
      id: "4",
      'avatar({"size":32})': "small.png",
    },
  });
});

test("binds different fragment arguments for the same entity at different paths", async () => {
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
            lead: { __typename: "User", id: "1", avatar: "large.png" },
            members: [{ __typename: "User", id: "1", avatar: "small.png" }],
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
      lead: { __typename: "User", id: "1", avatar: "large.png" },
      members: [{ __typename: "User", id: "1", avatar: "small.png" }],
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
      members: [{ __ref: "User:1" }],
    },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
      'avatar({"size":32})': "small.png",
    },
  });
});

test("binds different fragment arguments for a shared child entity at different paths", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(size: 96)
      }
      member {
        ...UserCard(size: 32)
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
            lead: {
              __typename: "User",
              id: "1",
              bestFriend: { __typename: "User", id: "3", avatar: "large.png" },
            },
            member: {
              __typename: "User",
              id: "2",
              bestFriend: { __typename: "User", id: "3", avatar: "small.png" },
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
      lead: {
        __typename: "User",
        id: "1",
        bestFriend: { __typename: "User", id: "3", avatar: "large.png" },
      },
      member: {
        __typename: "User",
        id: "2",
        bestFriend: { __typename: "User", id: "3", avatar: "small.png" },
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
      member: { __ref: "User:2" },
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
      'avatar({"size":96})': "large.png",
      'avatar({"size":32})': "small.png",
    },
  });
});

test("passes fragment arguments to read functions of @client fields", async () => {
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
      localAvatar(size: $size) @client
    }
  `;

  const read = jest.fn(
    (_: unknown, { args }: { args: Record<string, any> | null }) =>
      `local-${args?.size}.png`
  );

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        User: {
          fields: {
            localAvatar: { read },
          },
        },
      },
    }),
    localState: new LocalState(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1" },
            members: [{ __typename: "User", id: "2" }],
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
      lead: { __typename: "User", id: "1", localAvatar: "local-96.png" },
      members: [{ __typename: "User", id: "2", localAvatar: "local-32.png" }],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(read).toHaveBeenCalledWith(
    undefined,
    expect.objectContaining({ args: { size: 96 }, variables: { size: 96 } })
  );
  expect(read).toHaveBeenCalledWith(
    undefined,
    expect.objectContaining({ args: { size: 32 }, variables: { size: 32 } })
  );
});

test("removes fragment variables that are only used by @client fields from the request", async () => {
  const query = gql`
    query Team($n: Int) {
      lead {
        ...UserCard(size: $n)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      localAvatar(size: $size) @client
    }
  `;

  let requestQuery!: DocumentNode;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        User: {
          fields: {
            localAvatar: {
              read: (_, { args }) => `local-${args?.size}.png`,
            },
          },
        },
      },
    }),
    localState: new LocalState(),
    link: new ApolloLink((operation) => {
      requestQuery = operation.query;

      return of({ data: { lead: { __typename: "User", id: "1" } } });
    }),
  });

  using stream = new ObservableStream(
    client.watchQuery({ query, variables: { n: 96 } })
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
      lead: { __typename: "User", id: "1", localAvatar: "local-96.png" },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(requestQuery).toMatchDocument(gql`
    query Team {
      lead {
        ...UserCard
        __typename
      }
    }

    fragment UserCard on User {
      id
      __typename
    }
  `);
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

  using stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: {
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
      members: [{ __typename: "User", id: "2", avatar: "member.png" }],
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

test("emits only the path whose fragment argument scope changes in the cache", async () => {
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
            lead: { __typename: "User", id: "1", avatar: "large.png" },
            members: [{ __typename: "User", id: "1", avatar: "small.png" }],
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
      lead: { __typename: "User", id: "1", avatar: "large.png" },
      members: [{ __typename: "User", id: "1", avatar: "small.png" }],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  client.cache.modify({
    id: "User:1",
    fields: {
      avatar: (value, { storeFieldName }) =>
        storeFieldName === 'avatar({"size":32})' ? "small-updated.png" : value,
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      lead: { __typename: "User", id: "1", avatar: "large.png" },
      members: [{ __typename: "User", id: "1", avatar: "small-updated.png" }],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

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

test("evaluates directives on a fragment spread with the parent fragment scope", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(flag: false)
      }
    }

    fragment UserCard($flag: Boolean!) on User {
      id
      ...UserAvatar(flag: true) @include(if: $flag)
      ...UserName(flag: true) @skip(if: $flag)
    }

    fragment UserAvatar($flag: Boolean!) on User {
      avatar @include(if: $flag)
    }

    fragment UserName($flag: Boolean!) on User {
      name @include(if: $flag)
    }
  `;

  using _ = spyOnConsole("error");

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", name: "Lead" },
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
      lead: { __typename: "User", id: "1", name: "Lead" },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(console.error).not.toHaveBeenCalled();
  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      lead: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      name: "Lead",
    },
  });
});

test("does not warn about fields excluded by a fragment argument in @include", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(includeAvatar: true)
      }
      member {
        ...UserCard(includeAvatar: false)
      }
    }

    fragment UserCard($includeAvatar: Boolean!) on User {
      id
      avatar @include(if: $includeAvatar)
    }
  `;

  using _ = spyOnConsole("error");

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "lead.png" },
            member: { __typename: "User", id: "2" },
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
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
      member: { __typename: "User", id: "2" },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(console.error).not.toHaveBeenCalled();
});

test("binds fragment arguments on a deferred fragment spread", async () => {
  const query = gql`
    query Team {
      lead {
        id
        ...UserCard(size: 96) @defer
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { lead: { __typename: "User", id: "1" } },
    pending: [{ id: "0", path: ["lead"], label: "ac_0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      lead: { __typename: "User", id: "1" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [{ id: "0", data: { avatar: "lead.png" } }],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
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
      'avatar({"size":96})': "lead.png",
    },
  });
});

test("uses a fragment argument in @defer", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(deferAvatar: true)
      }
      member {
        ...UserCard(deferAvatar: false)
      }
    }

    fragment UserCard($deferAvatar: Boolean!) on User {
      id
      ... @defer(if: $deferAvatar) {
        avatar
      }
    }
  `;

  using _ = spyOnConsole("error");

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      lead: { __typename: "User", id: "1" },
      member: { __typename: "User", id: "2", avatar: "member.png" },
    },
    pending: [{ id: "0", path: ["lead"], label: "ac_0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      lead: { __typename: "User", id: "1" },
      member: { __typename: "User", id: "2", avatar: "member.png" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [{ id: "0", data: { avatar: "lead.png" } }],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
      member: { __typename: "User", id: "2", avatar: "member.png" },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(console.error).not.toHaveBeenCalled();
});

test("binds new operation variables passed through a fragment spread on refetch", async () => {
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
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
      {
        request: { query, variables: { n: 32 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "small.png" },
          },
        },
      },
    ]),
  });

  const observable = client.watchQuery({ query, variables: { n: 96 } });
  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      lead: { __typename: "User", id: "1", avatar: "large.png" },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(observable.refetch({ n: 32 })).resolves.toStrictEqualTyped({
    data: {
      lead: { __typename: "User", id: "1", avatar: "small.png" },
    },
  });

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      lead: { __typename: "User", id: "1", avatar: "small.png" },
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
      'avatar({"size":32})': "small.png",
    },
  });
});

test("updates the matching fragment argument scope with a mutation result", async () => {
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

  const mutation = gql`
    mutation UpdateAvatar {
      updateAvatar {
        ...UserCard(size: 96)
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
            lead: { __typename: "User", id: "1", avatar: "large.png" },
            members: [{ __typename: "User", id: "1", avatar: "small.png" }],
          },
        },
      },
      {
        request: { query: mutation },
        result: {
          data: {
            updateAvatar: {
              __typename: "User",
              id: "1",
              avatar: "large-updated.png",
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
      lead: { __typename: "User", id: "1", avatar: "large.png" },
      members: [{ __typename: "User", id: "1", avatar: "small.png" }],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(client.mutate({ mutation })).resolves.toStrictEqualTyped({
    data: {
      updateAvatar: {
        __typename: "User",
        id: "1",
        avatar: "large-updated.png",
      },
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      lead: { __typename: "User", id: "1", avatar: "large-updated.png" },
      members: [{ __typename: "User", id: "1", avatar: "small.png" }],
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
      members: [{ __ref: "User:1" }],
    },
    ROOT_MUTATION: {
      __typename: "Mutation",
    },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large-updated.png",
      'avatar({"size":32})': "small.png",
    },
  });
});

test("updates the matching fragment argument scope with an optimistic response", async () => {
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

  const mutation = gql`
    mutation UpdateAvatar {
      updateAvatar {
        ...UserCard(size: 96)
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
            lead: { __typename: "User", id: "1", avatar: "large.png" },
            members: [{ __typename: "User", id: "1", avatar: "small.png" }],
          },
        },
      },
      {
        request: { query: mutation },
        result: {
          data: {
            updateAvatar: {
              __typename: "User",
              id: "1",
              avatar: "large-updated.png",
            },
          },
        },
        delay: 20,
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
      lead: { __typename: "User", id: "1", avatar: "large.png" },
      members: [{ __typename: "User", id: "1", avatar: "small.png" }],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  const promise = client.mutate({
    mutation,
    optimisticResponse: {
      updateAvatar: {
        __typename: "User",
        id: "1",
        avatar: "large-optimistic.png",
      },
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      lead: { __typename: "User", id: "1", avatar: "large-optimistic.png" },
      members: [{ __typename: "User", id: "1", avatar: "small.png" }],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(promise).resolves.toStrictEqualTyped({
    data: {
      updateAvatar: {
        __typename: "User",
        id: "1",
        avatar: "large-updated.png",
      },
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      lead: { __typename: "User", id: "1", avatar: "large-updated.png" },
      members: [{ __typename: "User", id: "1", avatar: "small.png" }],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("passes the fragment argument scope to keyArgs and merge functions", async () => {
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
    cache: new InMemoryCache({
      typePolicies: {
        User: {
          fields: {
            avatar: {
              keyArgs: (_, { variables }) => `size-${variables?.size}`,
              merge: (_, incoming, { args, variables }) =>
                `${incoming}?arg=${args?.size}&variable=${variables?.size}`,
            },
          },
        },
      },
    }),
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
      lead: {
        __typename: "User",
        id: "1",
        avatar: "lead.png?arg=96&variable=96",
      },
      members: [
        {
          __typename: "User",
          id: "2",
          avatar: "member.png?arg=32&variable=32",
        },
      ],
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
      members: [{ __ref: "User:2" }],
    },
    "User:1": {
      __typename: "User",
      id: "1",
      "avatar:size-96": "lead.png?arg=96&variable=96",
    },
    "User:2": {
      __typename: "User",
      id: "2",
      "avatar:size-32": "member.png?arg=32&variable=32",
    },
  });
});

test("uses fragment arguments in inline fragments", async () => {
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
      ... on User {
        avatar(size: $size)
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      possibleTypes: { User: ["User"] },
    }),
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
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
      members: [{ __typename: "User", id: "2", avatar: "member.png" }],
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

test("binds fragment arguments for fragments from the fragment registry", async () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(size: 96)
      }
      members {
        ...UserCard(size: 32)
      }
    }
  `;

  let requestQuery!: DocumentNode;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      fragments: createFragmentRegistry(gql`
        fragment UserCard($size: Int) on User {
          id
          avatar(size: $size)
        }
      `),
    }),
    link: new ApolloLink((operation) => {
      requestQuery = operation.query;

      return of({
        data: {
          lead: { __typename: "User", id: "1", avatar: "lead.png" },
          members: [{ __typename: "User", id: "2", avatar: "member.png" }],
        },
      }).pipe(delay(20));
    }),
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
      lead: { __typename: "User", id: "1", avatar: "lead.png" },
      members: [{ __typename: "User", id: "2", avatar: "member.png" }],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(requestQuery).toMatchDocument(gql`
    query Team {
      lead {
        ...UserCard(size: 96)
        __typename
      }
      members {
        ...UserCard(size: 32)
        __typename
      }
    }

    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
      __typename
    }
  `);

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
