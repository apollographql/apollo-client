import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import {
  getFragmentQueryDocument,
  rootFragmentVariablesSymbol,
} from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("broadcasts to each watch with different root fragment variables that share a callback", () => {
  const query = getFragmentQueryDocument(gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `);

  const cache = new InMemoryCache();

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      'avatar({"size":96})': "large.png",
      'avatar({"size":32})': "small.png",
    },
  });

  const callback = jest.fn();

  cache.watch({
    query,
    id: "User:1",
    variables: {},
    optimistic: true,
    immediate: true,
    returnPartialData: true,
    [rootFragmentVariablesSymbol]: { size: 96 },
    callback,
  });

  cache.watch({
    query,
    id: "User:1",
    variables: {},
    optimistic: true,
    immediate: true,
    returnPartialData: true,
    [rootFragmentVariablesSymbol]: { size: 32 },
    callback,
  });

  expect(callback).toHaveBeenCalledTimes(2);
  expect(callback.mock.calls[0][0].result).toStrictEqualTyped({
    __typename: "User",
    id: "1",
    avatar: "large.png",
  });
  expect(callback.mock.calls[1][0].result).toStrictEqualTyped({
    __typename: "User",
    id: "1",
    avatar: "small.png",
  });
});
