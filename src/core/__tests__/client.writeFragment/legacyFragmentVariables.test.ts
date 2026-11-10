import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";

enableExperimentalFragmentVariables();

test("uses variables in a root fragment that declares variables", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    id: "User:1",
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
    },
  });
});

test("uses variables in a nested fragment that declares variables", () => {
  const fragment = gql`
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
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    fragmentName: "UserCard",
    id: "User:1",
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
    },
  });
});

test("ignores default values in a nested fragment that declares variables", () => {
  const fragment = gql`
    fragment UserCard on User {
      id
      ...UserAvatar
    }

    fragment UserAvatar($size: Int = 32) on User {
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    fragmentName: "UserCard",
    id: "User:1",
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      avatar: "small.png",
    },
  });
});
