import { mask } from "../masking.js";
import { InMemoryCache, gql } from "../index.js";
import { InlineFragmentNode } from "graphql";
import { deepFreeze } from "../../utilities/common/maybeDeepFreeze.js";

test("strips top-level fragment data from query", () => {
  const query = gql`
    query {
      foo
      ...QueryFields
    }

    fragment QueryFields on Query {
      bar
    }
  `;

  const data = mask(
    { foo: true, bar: true },
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({ foo: true });
});

test("strips fragment data from nested object", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      name
    }
  `;

  const data = mask(
    { user: { __typename: "User", id: 1, name: "Test User" } },
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({ user: { __typename: "User", id: 1 } });
});

test("strips fragment data from arrays", () => {
  const query = gql`
    query {
      users {
        __typename
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      name
    }
  `;

  const data = mask(
    {
      users: [
        { __typename: "User", id: 1, name: "Test User 1" },
        { __typename: "User", id: 2, name: "Test User 2" },
      ],
    },
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({
    users: [
      { __typename: "User", id: 1 },
      { __typename: "User", id: 2 },
    ],
  });
});

test("strips multiple fragments in the same selection set", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        ...UserProfileFields
        ...UserAvatarFields
      }
    }

    fragment UserProfileFields on User {
      age
    }

    fragment UserAvatarFields on User {
      avatarUrl
    }
  `;

  const data = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        age: 30,
        avatarUrl: "https://example.com/avatar.jpg",
      },
    },
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({
    user: { __typename: "User", id: 1 },
  });
});

test("strips multiple fragments across different selection sets", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        ...UserFields
      }
      post {
        __typename
        id
        ...PostFields
      }
    }

    fragment UserFields on User {
      name
    }

    fragment PostFields on Post {
      title
    }
  `;

  const data = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        name: "test user",
      },
      post: {
        __typename: "Post",
        id: 1,
        title: "Test Post",
      },
    },
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({
    user: { __typename: "User", id: 1 },
    post: { __typename: "Post", id: 1 },
  });
});

test("leaves overlapping fields in query", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        birthdate
        ...UserProfileFields
      }
    }

    fragment UserProfileFields on User {
      birthdate
      name
    }
  `;

  const data = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        birthdate: "1990-01-01",
        name: "Test User",
      },
    },
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({
    user: { __typename: "User", id: 1, birthdate: "1990-01-01" },
  });
});

test("does not strip inline fragments", () => {
  const cache = new InMemoryCache({
    possibleTypes: { Profile: ["UserProfile"] },
  });

  const query = gql`
    query {
      user {
        __typename
        id
        ... @defer {
          name
        }
      }
      profile {
        __typename
        ... on UserProfile {
          avatarUrl
        }
      }
    }
  `;

  const data = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
      profile: {
        __typename: "UserProfile",
        avatarUrl: "https://example.com/avatar.jpg",
      },
    },
    query,
    createFragmentMatcher(cache)
  );

  expect(data).toEqual({
    user: {
      __typename: "User",
      id: 1,
      name: "Test User",
    },
    profile: {
      __typename: "UserProfile",
      avatarUrl: "https://example.com/avatar.jpg",
    },
  });
});

test("strips named fragments inside inline fragments", () => {
  const cache = new InMemoryCache({
    possibleTypes: { Industry: ["TechIndustry"], Profile: ["UserProfile"] },
  });
  const query = gql`
    query {
      user {
        __typename
        id
        ... @defer {
          name
          ...UserFields
        }
      }
      profile {
        __typename
        ... on UserProfile {
          avatarUrl
          ...UserProfileFields
        }
        industry {
          __typename
          ... on TechIndustry {
            ...TechIndustryFields
          }
        }
      }
    }

    fragment UserFields on User {
      age
    }

    fragment UserProfileFields on UserProfile {
      hometown
    }

    fragment TechIndustryFields on TechIndustry {
      favoriteLanguage
    }
  `;

  const data = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
      profile: {
        __typename: "UserProfile",
        avatarUrl: "https://example.com/avatar.jpg",
        industry: { __typename: "TechIndustry", primaryLanguage: "TypeScript" },
      },
    },
    query,
    createFragmentMatcher(cache)
  );

  expect(data).toEqual({
    user: {
      __typename: "User",
      id: 1,
      name: "Test User",
    },
    profile: {
      __typename: "UserProfile",
      avatarUrl: "https://example.com/avatar.jpg",
      industry: { __typename: "TechIndustry" },
    },
  });
});

test("handles objects with no matching inline fragment condition", () => {
  const cache = new InMemoryCache({
    possibleTypes: {
      Drink: ["HotChocolate", "Juice"],
    },
  });

  const query = gql`
    query {
      drinks {
        __typename
        id
        ... on Juice {
          fruitBase
        }
      }
    }
  `;

  const data = mask(
    {
      drinks: [
        { __typename: "HotChocolate", id: 1 },
        { __typename: "Juice", id: 2, fruitBase: "Strawberry" },
      ],
    },
    query,
    createFragmentMatcher(cache)
  );

  expect(data).toEqual({
    drinks: [
      { __typename: "HotChocolate", id: 1 },
      { __typename: "Juice", id: 2, fruitBase: "Strawberry" },
    ],
  });
});

test("handles field aliases", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        fullName: name
        ... @defer {
          userAddress: address
        }
      }
    }
  `;

  const data = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        fullName: "Test User",
        userAddress: "1234 Main St",
      },
    },
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({
    user: {
      __typename: "User",
      id: 1,
      fullName: "Test User",
      userAddress: "1234 Main St",
    },
  });
});

test("handles overlapping fields inside multiple inline fragments", () => {
  const cache = new InMemoryCache({
    possibleTypes: {
      Drink: [
        "Espresso",
        "Latte",
        "Cappuccino",
        "Cortado",
        "Juice",
        "HotChocolate",
      ],
      Espresso: ["Latte", "Cappuccino", "Cortado"],
    },
  });
  const query = gql`
    query {
      drinks {
        __typename
        id
        ... @defer {
          amount
        }
        ... on Espresso {
          milkType
          ... on Latte {
            flavor {
              __typename
              name
              ...FlavorFields
            }
          }
          ... on Cappuccino {
            roast
          }
          ... on Cortado {
            ...CortadoFields
          }
        }
        ... on Latte {
          ... @defer {
            shots
          }
        }
        ... on Juice {
          ...JuiceFields
        }
        ... on HotChocolate {
          milkType
          ...HotChocolateFields
        }
      }
    }

    fragment JuiceFields on Juice {
      fruitBase
    }

    fragment HotChocolateFields on HotChocolate {
      chocolateType
    }

    fragment FlavorFields on Flavor {
      sweetness
    }

    fragment CortadoFields on Cortado {
      temperature
    }
  `;

  const data = mask(
    {
      drinks: [
        {
          __typename: "Latte",
          id: 1,
          amount: 12,
          shots: 2,
          milkType: "Cow",
          flavor: {
            __typename: "Flavor",
            name: "Cookie Butter",
            sweetness: "high",
          },
        },
        {
          __typename: "Cappuccino",
          id: 2,
          amount: 12,
          milkType: "Cow",
          roast: "medium",
        },
        {
          __typename: "Cortado",
          id: 3,
          amount: 12,
          milkType: "Cow",
          temperature: 150,
        },
        { __typename: "Juice", id: 4, amount: 10, fruitBase: "Apple" },
        {
          __typename: "HotChocolate",
          id: 5,
          amount: 8,
          milkType: "Cow",
          chocolateType: "dark",
        },
      ],
    },
    query,
    createFragmentMatcher(cache)
  );

  expect(data).toEqual({
    drinks: [
      {
        __typename: "Latte",
        id: 1,
        amount: 12,
        shots: 2,
        milkType: "Cow",
        flavor: {
          __typename: "Flavor",
          name: "Cookie Butter",
        },
      },
      {
        __typename: "Cappuccino",
        id: 2,
        amount: 12,
        milkType: "Cow",
        roast: "medium",
      },
      {
        __typename: "Cortado",
        id: 3,
        amount: 12,
        milkType: "Cow",
      },
      { __typename: "Juice", id: 4, amount: 10 },
      {
        __typename: "HotChocolate",
        id: 5,
        amount: 8,
        milkType: "Cow",
      },
    ],
  });
});

test("does nothing if there are no fragments to mask", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        name
      }
    }
  `;

  const data = mask(
    { user: { __typename: "User", id: 1, name: "Test User" } },
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({
    user: { __typename: "User", id: 1, name: "Test User" },
  });
});

test("maintains referential equality on subtrees that did not change", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        profile {
          __typename
          avatarUrl
        }
        ...UserFields
      }
      post {
        __typename
        id
        title
      }
      authors {
        __typename
        id
        name
      }
      industries {
        __typename
        ... on TechIndustry {
          languageRequirements
        }
        ... on FinanceIndustry {
          ...FinanceIndustryFields
        }
        ... on TradeIndustry {
          id
          yearsInBusiness
          ...TradeIndustryFields
        }
      }
      drink {
        __typename
        ... on SportsDrink {
          saltContent
        }
        ... on Espresso {
          __typename
        }
      }
    }

    fragment UserFields on User {
      name
    }

    fragment FinanceIndustryFields on FinanceIndustry {
      yearsInBusiness
    }

    fragment TradeIndustryFields on TradeIndustry {
      languageRequirements
    }
  `;

  const profile = {
    __typename: "Profile",
    avatarUrl: "https://example.com/avatar.jpg",
  };
  const user = { __typename: "User", id: 1, name: "Test User", profile };
  const post = { __typename: "Post", id: 1, title: "Test Post" };
  const authors = [{ __typename: "Author", id: 1, name: "A Author" }];
  const industries = [
    { __typename: "TechIndustry", languageRequirements: ["TypeScript"] },
    { __typename: "FinanceIndustry", yearsInBusiness: 10 },
    {
      __typename: "TradeIndustry",
      id: 10,
      yearsInBusiness: 15,
      languageRequirements: ["English", "German"],
    },
  ];
  const drink = { __typename: "Espresso" };
  const originalData = deepFreeze({ user, post, authors, industries, drink });

  const data = mask(
    originalData,
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({
    user: {
      __typename: "User",
      id: 1,
      profile: {
        __typename: "Profile",
        avatarUrl: "https://example.com/avatar.jpg",
      },
    },
    post: { __typename: "Post", id: 1, title: "Test Post" },
    authors: [{ __typename: "Author", id: 1, name: "A Author" }],
    industries: [
      { __typename: "TechIndustry", languageRequirements: ["TypeScript"] },
      { __typename: "FinanceIndustry" },
      { __typename: "TradeIndustry", id: 10, yearsInBusiness: 15 },
    ],
    drink: { __typename: "Espresso" },
  });

  expect(data).not.toBe(originalData);
  expect(data.user).not.toBe(user);
  expect(data.user.profile).toBe(profile);
  expect(data.post).toBe(post);
  expect(data.authors).toBe(authors);
  expect(data.industries).not.toBe(industries);
  expect(data.industries[0]).toBe(industries[0]);
  expect(data.industries[1]).not.toBe(industries[1]);
  expect(data.industries[2]).not.toBe(industries[2]);
  expect(data.drink).toBe(drink);
});

test("maintains referential equality the entire result if there are no fragments", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        name
      }
    }
  `;

  const originalData = deepFreeze({
    user: {
      __typename: "User",
      id: 1,
      name: "Test User",
    },
  });

  const data = mask(
    originalData,
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toBe(originalData);
});

function createFragmentMatcher(cache: InMemoryCache) {
  return (node: InlineFragmentNode, typename: string) =>
    cache.policies.fragmentMatches(node, typename);
}
