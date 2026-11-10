import type { TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import type { WithFragmentInfo } from "@apollo/client/testing/internal";
import { dateScalar, spyOnConsole } from "@apollo/client/testing/internal";
import { fragmentInfoSymbol } from "@apollo/client/utilities/internal";

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

test("uses a fragment argument in @include when matching a fuzzy subtype from possibleTypes", () => {
  const fragment = gql`
    fragment HeroCard on HeroUser {
      id
      ...CharacterAvatar(includeAvatar: true)
    }

    fragment CharacterAvatar($includeAvatar: Boolean!) on Character {
      avatar @include(if: $includeAvatar)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      possibleTypes: { Character: ["Hero.*"] },
    }),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    fragmentName: "HeroCard",
    id: "HeroUser:1",
    data: { __typename: "HeroUser", id: "1", avatar: "hero.png" },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["HeroUser:1"] },
    "HeroUser:1": {
      __typename: "HeroUser",
      id: "1",
      avatar: "hero.png",
    },
  });
});

test("writes operation variables of a nested fragment shadowed by a parent fragment argument from data read from a query result", () => {
  const barFragment = gql`
    fragment Bar on User {
      value(x: $x)
    }
  `;

  const fooFragment = gql`
    fragment Foo($x: Int!) on User {
      id
      fooValue: value(x: $x)
      ...Bar
    }

    ${barFragment}
  `;

  const query: TypedDocumentNode<
    WithFragmentInfo<{
      user: {
        __typename: "User";
        id: string;
        fooValue: number;
        value: number;
      };
    }>,
    { x: number }
  > = gql`
    query Example($x: Int) {
      user {
        id
        ...Foo(x: 1)
      }
    }

    ${fooFragment}
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeQuery({
    query,
    variables: { x: 99 },
    data: {
      user: { __typename: "User", id: "1", fooValue: 1, value: 99 },
    },
  });

  const data = client.readQuery({ query, variables: { x: 99 } });

  expect(data).toStrictEqualTyped({
    user: {
      __typename: "User",
      id: "1",
      fooValue: 1,
      value: 99,
      [fragmentInfoSymbol]: {
        operationVariables: { x: 99 },
        fragments: {
          Foo: { variables: { x: 1 } },
          Bar: { variables: { x: 99 } },
        },
      },
    },
  });

  client.writeFragment({
    fragment: fooFragment,
    fragmentName: "Foo",
    data: { ...data!.user, fooValue: 2, value: 100 },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      'value({"x":1})': 2,
      'value({"x":99})': 100,
    },
  });

  expect(client.readQuery({ query, variables: { x: 99 } })).toStrictEqualTyped({
    user: {
      __typename: "User",
      id: "1",
      fooValue: 2,
      value: 100,
      [fragmentInfoSymbol]: {
        operationVariables: { x: 99 },
        fragments: {
          Foo: { variables: { x: 1 } },
          Bar: { variables: { x: 99 } },
        },
      },
    },
  });
});

test("serializes custom scalar variables bound to root fragment arguments", () => {
  const fragment = gql`
    fragment EventFields($since: Date!) on Event {
      id
      attendees(since: $since)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({ scalars: { Date: dateScalar } }),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    id: "Event:1",
    variables: { since: new Date(2026, 0, 1) },
    data: { __typename: "Event", id: "1", attendees: 10 },
  });

  expect(client.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["Event:1"] },
    "Event:1": {
      __typename: "Event",
      id: "1",
      'attendees({"since":"2026-01-01"})': 10,
    },
  });
});
