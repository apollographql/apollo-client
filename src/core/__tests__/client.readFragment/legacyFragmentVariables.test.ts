import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { fragmentVariablesSymbol } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("uses variables in a root fragment that declares variables", () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache().restore({
      "User:1": {
        __typename: "User",
        id: "1",
        avatar: "default.png",
        'avatar({"size":96})': "large.png",
      },
    }),
  });

  expect(
    client.readFragment({ fragment, id: "User:1", variables: { size: 96 } })
  ).toStrictEqualTyped({ __typename: "User", id: "1", avatar: "large.png" });
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
    link: ApolloLink.empty(),
    cache: new InMemoryCache().restore({
      "User:1": {
        __typename: "User",
        id: "1",
        avatar: "default.png",
        'avatar({"size":96})': "large.png",
      },
    }),
  });

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
    [fragmentVariablesSymbol]: { UserAvatar: { size: 96 } },
  });
});
