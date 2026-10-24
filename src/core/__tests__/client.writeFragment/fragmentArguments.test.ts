import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { spyOnConsole } from "@apollo/client/testing/internal";

enableExperimentalFragmentVariables();

test("binds variables to the fragment arguments of the root fragment", () => {
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

test("applies fragment argument defaults of the root fragment when variables omit them", () => {
  const fragment = gql`
    fragment UserCard($size: Int = 48) on User {
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
    data: { __typename: "User", id: "1", avatar: "medium.png" },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":48})': "medium.png",
    },
  });
});

test("uses variables instead of the fragment argument defaults of the root fragment", () => {
  const fragment = gql`
    fragment UserCard($size: Int = 48) on User {
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

test("uses a null variable instead of the fragment argument default of the root fragment", () => {
  const fragment = gql`
    fragment UserCard($size: Int = 48) on User {
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
    variables: { size: null },
    data: { __typename: "User", id: "1", avatar: "null.png" },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":null})': "null.png",
    },
  });
});

test("writes a field without arguments when the root fragment argument has no value or default", () => {
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
    data: { __typename: "User", id: "1", avatar: "default.png" },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      avatar: "default.png",
    },
  });
});

test("uses a root fragment argument in @include", () => {
  const fragment = gql`
    fragment UserCard($includeAvatar: Boolean!) on User {
      id
      avatar @include(if: $includeAvatar)
    }
  `;

  using _ = spyOnConsole("error");

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    id: "User:1",
    variables: { includeAvatar: false },
    data: { __typename: "User", id: "1" },
  });

  expect(console.error).not.toHaveBeenCalled();
  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
    },
  });

  client.writeFragment({
    fragment,
    id: "User:1",
    variables: { includeAvatar: true },
    data: { __typename: "User", id: "1", avatar: "default.png" },
  });

  expect(console.error).not.toHaveBeenCalled();
  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      avatar: "default.png",
    },
  });
});

test("passes a root fragment argument through a nested fragment spread", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      ...UserAvatar(size: $size)
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

test("binds variables to the root fragment selected by fragmentName", () => {
  // UserAvatar is first so the root fragment is not the first definition.
  const fragment = gql`
    fragment UserAvatar($avatarSize: Int) on User {
      avatar(size: $avatarSize)
    }

    fragment UserCard($size: Int) on User {
      id
      ...UserAvatar(avatarSize: $size)
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

  client.writeFragment({
    fragment,
    fragmentName: "UserAvatar",
    id: "User:1",
    variables: { avatarSize: 32 },
    data: { __typename: "User", avatar: "small.png" },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
      'avatar({"size":32})': "small.png",
    },
  });
});

test("binds a literal fragment argument on a nested spread instead of variables", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
      ...UserAvatar(size: 32)
    }

    fragment UserAvatar($size: Int) on User {
      smallAvatar: avatar(size: $size)
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
    data: {
      __typename: "User",
      id: "1",
      avatar: "large.png",
      smallAvatar: "small.png",
    },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
      'avatar({"size":32})': "small.png",
    },
  });
});

test("binds fragment arguments of a nested spread when the root fragment declares no variables", () => {
  const fragment = gql`
    fragment UserCard on User {
      id
      ...UserAvatar(size: 96)
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

test("uses variables directly when the root fragment declares no variables", () => {
  const fragment = gql`
    fragment UserCard on User {
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

test("uses variables in a nested fragment that declares no variables when the root fragment declares a variable with the same name", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
      ...UserAvatar
    }

    fragment UserAvatar on User {
      nestedAvatar: avatar(size: $size)
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
    data: {
      __typename: "User",
      id: "1",
      avatar: "large.png",
      nestedAvatar: "large.png",
    },
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

test("uses variables in a nested fragment that declares no variables for a variable the root fragment does not declare", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
      ...UserBanner
    }

    fragment UserBanner on User {
      banner(width: $width)
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
    variables: { size: 96, width: 1200 },
    data: {
      __typename: "User",
      id: "1",
      avatar: "large.png",
      banner: "wide.png",
    },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
      'banner({"width":1200})': "wide.png",
    },
  });
});

test("reads data written with different root fragment arguments", () => {
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

  client.writeFragment({
    fragment,
    id: "User:1",
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  expect(
    client.readFragment({ fragment, id: "User:1", variables: { size: 96 } })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "large.png" });

  expect(
    client.readFragment({ fragment, id: "User:1", variables: { size: 32 } })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "small.png" });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
      'avatar({"size":32})': "small.png",
    },
  });
});
