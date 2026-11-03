import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  InMemoryCache,
} from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";

import { gql } from "./testUtils.js";

enableExperimentalFragmentVariables();

test("passes fragment arguments to local resolvers", async () => {
  const document = gql`
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

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      User: {
        localAvatar: (_, { size }: { size?: number }) => `local-${size}.png`,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: {
        data: {
          lead: { __typename: "User", id: "1" },
          members: [{ __typename: "User", id: "2" }],
        },
      },
      fetchPolicy: "cache-first",
    })
  ).resolves.toStrictEqualTyped({
    data: {
      lead: { __typename: "User", id: "1", localAvatar: "local-96.png" },
      members: [{ __typename: "User", id: "2", localAvatar: "local-32.png" }],
    },
  });
});

test("passes fragment arguments through nested fragment spreads to local resolvers", async () => {
  const document = gql`
    query Team {
      lead {
        ...UserCard(size: 96)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      ...UserAvatar(size: $size)
    }

    fragment UserAvatar($size: Int) on User {
      localAvatar(size: $size) @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      User: {
        localAvatar: (_, { size }: { size?: number }) => `local-${size}.png`,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { lead: { __typename: "User", id: "1" } } },
      fetchPolicy: "cache-first",
    })
  ).resolves.toStrictEqualTyped({
    data: {
      lead: { __typename: "User", id: "1", localAvatar: "local-96.png" },
    },
  });
});

test("passes default values of fragment variables to local resolvers", async () => {
  const document = gql`
    query Team {
      lead {
        ...UserCard
      }
    }

    fragment UserCard($size: Int = 32) on User {
      id
      localAvatar(size: $size) @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      User: {
        localAvatar: (_, { size }: { size?: number }) => `local-${size}.png`,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { lead: { __typename: "User", id: "1" } } },
      fetchPolicy: "cache-first",
    })
  ).resolves.toStrictEqualTyped({
    data: {
      lead: { __typename: "User", id: "1", localAvatar: "local-32.png" },
    },
  });
});

test("does not pass operation variables shadowed by fragment variables to local resolvers", async () => {
  const document = gql`
    query Team($size: Int) {
      lead {
        id
        avatar(size: $size)
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      localAvatar(size: $size) @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      User: {
        localAvatar: (_, { size }: { size?: number }) =>
          `local-${size ?? "default"}.png`,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: { size: 96 },
      remoteResult: {
        data: {
          lead: { __typename: "User", id: "1", avatar: "large.png" },
        },
      },
      fetchPolicy: "cache-first",
    })
  ).resolves.toStrictEqualTyped({
    data: {
      lead: {
        __typename: "User",
        id: "1",
        avatar: "large.png",
        localAvatar: "local-default.png",
      },
    },
  });
});

test("uses fragment arguments in @include on @client fields", async () => {
  const document = gql`
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
      localAvatar @client @include(if: $includeAvatar)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      User: {
        localAvatar: (user: { id: string }) => `local-${user.id}.png`,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: {
        data: {
          lead: { __typename: "User", id: "1" },
          member: { __typename: "User", id: "2" },
        },
      },
      fetchPolicy: "cache-first",
    })
  ).resolves.toStrictEqualTyped({
    data: {
      lead: { __typename: "User", id: "1", localAvatar: "local-1.png" },
      member: { __typename: "User", id: "2" },
    },
  });
});
