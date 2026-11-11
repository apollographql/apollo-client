import type { TypedDocumentNode } from "@apollo/client";
import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import type { WithFragmentInfo } from "@apollo/client/testing/internal";
import { fragmentInfoSymbol } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("binds variables to the fragment arguments of the root fragment", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const cache = new InMemoryCache();

  cache.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  cache.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  const update = jest.fn((data: any) => ({
    ...data,
    avatar: "large-updated.png",
  }));

  const result = cache.updateFragment(
    { fragment, id: "User:1", variables: { size: 96 } },
    update
  );

  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith({
    __typename: "User",
    id: "1",
    avatar: "large.png",
  });
  expect(result).toStrictEqualTyped({
    __typename: "User",
    id: "1",
    avatar: "large-updated.png",
  });

  expect(cache.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large-updated.png",
      'avatar({"size":32})': "small.png",
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

  const cache = new InMemoryCache();

  cache.writeFragment({
    fragment,
    variables: { size: 48 },
    data: { __typename: "User", id: "1", avatar: "medium.png" },
  });

  const update = jest.fn((data: any) => ({
    ...data,
    avatar: "medium-updated.png",
  }));

  cache.updateFragment({ fragment, id: "User:1" }, update);

  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith({
    __typename: "User",
    id: "1",
    avatar: "medium.png",
  });

  expect(cache.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":48})': "medium-updated.png",
    },
  });
});

test("passes null to the update function when there is no data for the root fragment arguments", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const cache = new InMemoryCache();

  cache.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  const update = jest.fn(() => ({
    __typename: "User",
    id: "1",
    avatar: "small.png",
  }));

  cache.updateFragment(
    { fragment, id: "User:1", variables: { size: 32 } },
    update
  );

  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith(null);

  expect(cache.extract()).toStrictEqualTyped({
    __META: { extraRootIds: ["User:1"] },
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
      'avatar({"size":32})': "small.png",
    },
  });
});

test("updates operation variables of a nested fragment shadowed by a parent fragment argument from a query result passed to from", () => {
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

  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    variables: { x: 99 },
    data: {
      user: { __typename: "User", id: "1", fooValue: 1, value: 99 },
    },
  });

  const data = cache.readQuery({ query, variables: { x: 99 } });

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
        },
      },
    },
  });

  const update = jest.fn((data: any) => ({
    ...data,
    fooValue: 2,
    value: 100,
  }));

  const result = cache.updateFragment(
    { fragment: fooFragment, fragmentName: "Foo", from: data!.user },
    update
  );

  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith({
    __typename: "User",
    id: "1",
    fooValue: 1,
    value: 99,
    [fragmentInfoSymbol]: {
      operationVariables: { x: 99 },
      fragments: {},
    },
  });
  expect(result).toStrictEqualTyped({
    __typename: "User",
    id: "1",
    fooValue: 2,
    value: 100,
    [fragmentInfoSymbol]: {
      operationVariables: { x: 99 },
      fragments: {},
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
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

  expect(cache.readQuery({ query, variables: { x: 99 } })).toStrictEqualTyped({
    user: {
      __typename: "User",
      id: "1",
      fooValue: 2,
      value: 100,
      [fragmentInfoSymbol]: {
        operationVariables: { x: 99 },
        fragments: {
          Foo: { variables: { x: 1 } },
        },
      },
    },
  });
});
