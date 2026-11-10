import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";

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
