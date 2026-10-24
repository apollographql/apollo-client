import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { InMemoryCache, MissingFieldError } from "@apollo/client/cache";
import { handleIncrementalSymbol } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("evaluates @defer on a fragment spread with the parent fragment scope", () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(deferDetails: false)
      }
    }

    fragment UserCard($deferDetails: Boolean!) on User {
      id
      ...UserDetails(deferDetails: true) @defer(if: $deferDetails)
    }

    fragment UserDetails($deferDetails: Boolean!) on User {
      name
      nickname @include(if: $deferDetails)
    }
  `;

  const cache = new InMemoryCache();

  cache.restore({
    ROOT_QUERY: {
      __typename: "Query",
      lead: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: undefined,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      "Can't find field 'name' on User:1 object",
      {
        lead: {
          name: "Can't find field 'name' on User:1 object",
          nickname: "Can't find field 'nickname' on User:1 object",
        },
      },
      query,
      {}
    ),
  });
});
