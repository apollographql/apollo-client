import {
  ApolloClient,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { MockLink } from "@apollo/client/testing";

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
            lead: {
              __typename: "User",
              id: "1",
              avatar: "lead.png",
            },
            members: [
              {
                __typename: "User",
                id: "2",
                avatar: "member.png",
              },
            ],
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
      },
      members: [
        {
          __typename: "User",
          id: "2",
          avatar: "member.png",
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
            lead: {
              __typename: "User",
              id: "1",
              avatar: "default.png",
            },
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
        avatar: "default.png",
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
      'avatar({"size":48})': "default.png",
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

  await expect(
    client.query({ query, variables: { size: 32 } })
  ).resolves.toStrictEqualTyped({
    data: {
      lead: {
        __typename: "User",
        id: "1",
        photo: "photo-32.png",
        avatar: "avatar-96.png",
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
      'photo({"size":32})': "photo-32.png",
      'avatar({"size":96})': "avatar-96.png",
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
            lead: {
              __typename: "User",
              id: "1",
              avatar: "lead.png",
            },
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
            lead: {
              __typename: "User",
              id: "1",
              avatar: "lead.png",
            },
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

test("does not leak a fragment argument into a child fragment that does not declare it", async () => {
  const query = gql`
    query Example($x: Int) {
      user {
        ...Foo(x: 1)
      }
    }

    fragment Foo($x: Int!) on User {
      id
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
            user: {
              __typename: "User",
              id: "1",
              value: 99,
            },
          },
        },
      },
    ]),
  });

  await expect(
    client.query({ query, variables: { x: 99 } })
  ).resolves.toStrictEqualTyped({
    data: {
      user: {
        __typename: "User",
        id: "1",
        value: 99,
      },
    },
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
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
            lead: {
              __typename: "User",
              id: "1",
              avatar: "lead.png",
            },
            member: {
              __typename: "User",
              id: "2",
              avatar: "member.png",
            },
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
      },
      member: {
        __typename: "User",
        id: "2",
      },
    },
  });

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
      lead: {
        __typename: "User",
        id: "1",
        avatar: "lead.png",
      },
      members: [
        {
          __typename: "User",
          id: "2",
          avatar: "member.png",
        },
      ],
    },
  });

  await expect(client.query({ query })).resolves.toStrictEqualTyped({
    data: {
      lead: {
        __typename: "User",
        id: "1",
        avatar: "lead.png",
      },
      members: [
        {
          __typename: "User",
          id: "2",
          avatar: "member.png",
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
