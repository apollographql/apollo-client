import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { fragmentInfoSymbol } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("reads operation variables used by a nested fragment inside a fragment whose argument shadows the operation variable", () => {
  const query = gql`
    query Team($x: Int) {
      user {
        ...Foo(x: 1)
      }
    }

    fragment Foo($x: Int) on User {
      id
      value(x: $x)
      friend {
        id
        ...Bar
      }
    }

    fragment Bar on User {
      value(x: $x)
    }
  `;

  const cache = new InMemoryCache();

  cache.restore({
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      'value({"x":1})': "one",
      friend: { __ref: "User:2" },
    },
    "User:2": {
      __typename: "User",
      id: "2",
      'value({"x":99})': "ninety-nine",
      'value({"x":5})': "five",
    },
  });

  expect(cache.readQuery({ query, variables: { x: 99 } })).toStrictEqualTyped({
    user: {
      __typename: "User",
      id: "1",
      value: "one",
      friend: {
        __typename: "User",
        id: "2",
        value: "ninety-nine",
        [fragmentInfoSymbol]: {
          operationVariables: { x: 99 },
          fragments: {},
        },
      },
      [fragmentInfoSymbol]: {
        operationVariables: { x: 99 },
        fragments: { Foo: { variables: { x: 1 } } },
      },
    },
  });

  expect(cache.readQuery({ query, variables: { x: 5 } })).toStrictEqualTyped({
    user: {
      __typename: "User",
      id: "1",
      value: "one",
      friend: {
        __typename: "User",
        id: "2",
        value: "five",
        [fragmentInfoSymbol]: {
          operationVariables: { x: 5 },
          fragments: {},
        },
      },
      [fragmentInfoSymbol]: {
        operationVariables: { x: 5 },
        fragments: { Foo: { variables: { x: 1 } } },
      },
    },
  });
});

test("reads operation variables used by a nested fragment on list items inside a fragment whose argument shadows the operation variable", () => {
  const query = gql`
    query Team($x: Int) {
      user {
        ...Foo(x: 1)
      }
    }

    fragment Foo($x: Int) on User {
      id
      value(x: $x)
      friends {
        id
        ...Bar
      }
    }

    fragment Bar on User {
      value(x: $x)
    }
  `;

  const cache = new InMemoryCache();

  cache.restore({
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      'value({"x":1})': "one",
      friends: [{ __ref: "User:2" }],
    },
    "User:2": {
      __typename: "User",
      id: "2",
      'value({"x":99})': "ninety-nine",
      'value({"x":5})': "five",
    },
  });

  expect(cache.readQuery({ query, variables: { x: 99 } })).toStrictEqualTyped({
    user: {
      __typename: "User",
      id: "1",
      value: "one",
      friends: [
        {
          __typename: "User",
          id: "2",
          value: "ninety-nine",
          [fragmentInfoSymbol]: {
            operationVariables: { x: 99 },
            fragments: {},
          },
        },
      ],
      [fragmentInfoSymbol]: {
        operationVariables: { x: 99 },
        fragments: { Foo: { variables: { x: 1 } } },
      },
    },
  });

  expect(cache.readQuery({ query, variables: { x: 5 } })).toStrictEqualTyped({
    user: {
      __typename: "User",
      id: "1",
      value: "one",
      friends: [
        {
          __typename: "User",
          id: "2",
          value: "five",
          [fragmentInfoSymbol]: {
            operationVariables: { x: 5 },
            fragments: {},
          },
        },
      ],
      [fragmentInfoSymbol]: {
        operationVariables: { x: 5 },
        fragments: { Foo: { variables: { x: 1 } } },
      },
    },
  });
});

test("combines fragment info from overlapping selections of the same nested object", () => {
  const query = gql`
    query {
      user {
        id
        profile {
          id
          ...ProfileAvatar(size: 32)
        }
        ... on User {
          profile {
            id
            ...ProfileBio(locale: "en")
          }
        }
      }
    }

    fragment ProfileAvatar($size: Int) on Profile {
      avatar(size: $size)
    }

    fragment ProfileBio($locale: String) on Profile {
      bio(locale: $locale)
    }
  `;

  const cache = new InMemoryCache();

  cache.restore({
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      profile: { __ref: "Profile:1" },
    },
    "Profile:1": {
      __typename: "Profile",
      id: "1",
      'avatar({"size":32})': "small.png",
      'bio({"locale":"en"})': "Hello",
    },
  });

  expect(cache.readQuery({ query })).toStrictEqualTyped({
    user: {
      __typename: "User",
      id: "1",
      profile: {
        __typename: "Profile",
        id: "1",
        avatar: "small.png",
        bio: "Hello",
        [fragmentInfoSymbol]: {
          operationVariables: {},
          fragments: {
            ProfileAvatar: { variables: { size: 32 } },
            ProfileBio: { variables: { locale: "en" } },
          },
        },
      },
    },
  });
});
