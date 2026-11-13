import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";

enableExperimentalFragmentVariables();

test("writes nested objects of the same entity reached through the same fragment with different fragment arguments", () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(size: 32)
      }
      members {
        ...UserCard(size: 96)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      friend {
        id
        avatar(size: $size)
      }
    }
  `;

  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    data: {
      lead: {
        __typename: "User",
        id: "1",
        friend: { __typename: "User", id: "2", avatar: "small.png" },
      },
      members: [
        {
          __typename: "User",
          id: "1",
          friend: { __typename: "User", id: "2", avatar: "large.png" },
        },
      ],
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      lead: { __ref: "User:1" },
      members: [{ __ref: "User:1" }],
    },
    "User:1": {
      __typename: "User",
      id: "1",
      friend: { __ref: "User:2" },
    },
    "User:2": {
      __typename: "User",
      id: "2",
      'avatar({"size":32})': "small.png",
      'avatar({"size":96})': "large.png",
    },
  });
});
