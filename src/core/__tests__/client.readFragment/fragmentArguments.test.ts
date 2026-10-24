import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";

enableExperimentalFragmentVariables();

function createClient() {
  return new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache().restore({
      "User:1": {
        __typename: "User",
        id: "1",
        avatar: "default.png",
        'avatar({"size":32})': "small.png",
        'avatar({"size":48})': "medium.png",
        'avatar({"size":96})': "large.png",
        'avatar({"size":null})': "null.png",
      },
    }),
  });
}

test("binds variables to the fragment arguments of the root fragment", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = createClient();

  expect(
    client.readFragment({ fragment, id: "User:1", variables: { size: 96 } })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "large.png" });

  expect(
    client.readFragment({ fragment, id: "User:1", variables: { size: 32 } })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "small.png" });
});

test("applies fragment argument defaults of the root fragment when variables omit them", () => {
  const fragment = gql`
    fragment UserCard($size: Int = 48) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = createClient();

  expect(client.readFragment({ fragment, id: "User:1" })).toStrictEqualTyped({
    __typename: "User",
    id: "1",
    avatar: "medium.png",
  });

  expect(
    client.readFragment({ fragment, id: "User:1", variables: {} })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "medium.png" });
});

test("uses variables instead of the fragment argument defaults of the root fragment", () => {
  const fragment = gql`
    fragment UserCard($size: Int = 48) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = createClient();

  expect(
    client.readFragment({ fragment, id: "User:1", variables: { size: 96 } })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "large.png" });
});

test("uses a null variable instead of the fragment argument default of the root fragment", () => {
  const fragment = gql`
    fragment UserCard($size: Int = 48) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = createClient();

  expect(
    client.readFragment({ fragment, id: "User:1", variables: { size: null } })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "null.png" });
});

test("reads a field without arguments when the root fragment argument has no value or default", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = createClient();

  expect(client.readFragment({ fragment, id: "User:1" })).toStrictEqualTyped({
    __typename: "User",
    id: "1",
    avatar: "default.png",
  });
});

test("returns null when the cache has no data for the root fragment argument", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = createClient();

  expect(
    client.readFragment({ fragment, id: "User:1", variables: { size: 64 } })
  ).toBeNull();
});

test("uses a root fragment argument in @include", () => {
  const fragment = gql`
    fragment UserCard($includeAvatar: Boolean!) on User {
      id
      avatar @include(if: $includeAvatar)
    }
  `;

  const client = createClient();

  expect(
    client.readFragment({
      fragment,
      id: "User:1",
      variables: { includeAvatar: true },
    })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "default.png" });

  expect(
    client.readFragment({
      fragment,
      id: "User:1",
      variables: { includeAvatar: false },
    })
  ).toStrictEqualTyped({ __typename: "User", id: "1" });
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

  const client = createClient();

  expect(
    client.readFragment({
      fragment,
      fragmentName: "UserCard",
      id: "User:1",
      variables: { size: 96 },
    })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "large.png" });
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

  const client = createClient();

  expect(
    client.readFragment({
      fragment,
      fragmentName: "UserCard",
      id: "User:1",
      variables: { size: 96 },
    })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "large.png" });

  expect(
    client.readFragment({
      fragment,
      fragmentName: "UserAvatar",
      id: "User:1",
      variables: { avatarSize: 32 },
    })
  ).toStrictEqualTyped({ __typename: "User", avatar: "small.png" });
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

  const client = createClient();

  expect(
    client.readFragment({
      fragment,
      fragmentName: "UserCard",
      id: "User:1",
      variables: { size: 96 },
    })
  ).toStrictEqualTyped({
    __typename: "User",
    id: "1",
    avatar: "large.png",
    smallAvatar: "small.png",
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

  const client = createClient();

  expect(
    client.readFragment({ fragment, fragmentName: "UserCard", id: "User:1" })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "large.png" });
});

test("uses variables directly when the root fragment declares no variables", () => {
  const fragment = gql`
    fragment UserCard on User {
      id
      avatar(size: $size)
    }
  `;

  const client = createClient();

  expect(
    client.readFragment({ fragment, id: "User:1", variables: { size: 96 } })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "large.png" });
});
