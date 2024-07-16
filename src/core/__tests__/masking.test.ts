import { maskFragment, maskQuery } from "../masking.js";
import { InMemoryCache, gql } from "../index.js";
import { InlineFragmentNode } from "graphql";
import { deepFreeze } from "../../utilities/common/maybeDeepFreeze.js";
import { InvariantError } from "../../utilities/globals/index.js";
import { spyOnConsole } from "../../testing/internal/index.js";

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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
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

  const data = maskQuery(
    originalData,
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toBe(originalData);
});

test("does not mask fields when using `@unmask` directive", () => {
  // Silence masked field access warning
  using _ = spyOnConsole("warn");

  const query = gql`
    query UnmaskedQuery @unmask {
      currentUser {
        __typename
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
      profile {
        __typename
        email
        ... @defer {
          username
        }
        ...ProfileFields
      }
    }

    fragment ProfileFields on Profile {
      settings {
        __typename
        darkMode
      }
    }
  `;

  const data = maskQuery(
    {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
        profile: {
          __typename: "Profile",
          email: "testuser@example.com",
          username: "testuser",
          settings: {
            __typename: "Settings",
            darkMode: true,
          },
        },
      },
    },
    query,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toEqual({
    currentUser: {
      __typename: "User",
      id: 1,
      name: "Test User",
      age: 30,
      profile: {
        __typename: "Profile",
        email: "testuser@example.com",
        username: "testuser",
        settings: {
          __typename: "Settings",
          darkMode: true,
        },
      },
    },
  });
});

test("warns when accessing would-be masked fields when using `@unmask` directive", () => {
  using consoleSpy = spyOnConsole("warn");
  const query = gql`
    query UnmaskedQuery @unmask {
      currentUser {
        __typename
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const anonymousQuery = gql`
    query @unmask {
      currentUser {
        __typename
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const currentUser = {
    __typename: "User",
    id: 1,
    name: "Test User",
    age: 30,
  };

  const fragmentMatcher = createFragmentMatcher(new InMemoryCache());

  const data = maskQuery({ currentUser }, query, fragmentMatcher);

  const dataFromAnonymous = maskQuery(
    { currentUser },
    anonymousQuery,
    fragmentMatcher
  );

  data.currentUser.age;

  expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
  expect(consoleSpy.warn).toHaveBeenCalledWith(
    "Accessing unmasked field '%s' on %s. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
    "age",
    "query 'UnmaskedQuery'"
  );

  dataFromAnonymous.currentUser.age;

  expect(consoleSpy.warn).toHaveBeenCalledTimes(2);
  expect(consoleSpy.warn).toHaveBeenCalledWith(
    "Accessing unmasked field '%s' on %s. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
    "age",
    "anonymous query"
  );

  data.currentUser.age;
  dataFromAnonymous.currentUser.age;

  // Ensure we only warn once for each masked field
  expect(consoleSpy.warn).toHaveBeenCalledTimes(2);
});

test("does not warn when accessing fields shared between the query and fragment", () => {
  using consoleSpy = spyOnConsole("warn");
  const query = gql`
    query UnmaskedQuery @unmask {
      currentUser {
        __typename
        id
        name
        age
        ...UserFields
        email
      }
    }

    fragment UserFields on User {
      age
      email
    }
  `;

  const fragmentMatcher = createFragmentMatcher(new InMemoryCache());

  const data = maskQuery(
    {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
        email: "testuser@example.com",
      },
    },
    query,
    fragmentMatcher
  );

  data.currentUser.age;
  data.currentUser.email;

  expect(consoleSpy.warn).not.toHaveBeenCalled();
});

test("disables warnings when setting warnOnFieldAccess to false", () => {
  using consoleSpy = spyOnConsole("warn");
  const query = gql`
    query UnmaskedQuery @unmask(warnOnFieldAccess: false) {
      currentUser {
        __typename
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const fragmentMatcher = createFragmentMatcher(new InMemoryCache());

  const data = maskQuery(
    {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    },
    query,
    fragmentMatcher
  );

  data.currentUser.age;

  expect(consoleSpy.warn).not.toHaveBeenCalled();
});

test("masks named fragments in fragment documents", () => {
  const fragment = gql`
    fragment UserFields on User {
      __typename
      id
      ...UserProfile
    }

    fragment UserProfile on User {
      age
    }
  `;

  const data = maskFragment(
    { __typename: "User", id: 1, age: 30 },
    fragment,
    createFragmentMatcher(new InMemoryCache()),
    "UserFields"
  );

  expect(data).toEqual({ __typename: "User", id: 1 });
});

test("masks named fragments in nested fragment objects", () => {
  const fragment = gql`
    fragment UserFields on User {
      __typename
      id
      profile {
        __typename
        ...UserProfile
      }
    }

    fragment UserProfile on User {
      age
    }
  `;

  const data = maskFragment(
    { __typename: "User", id: 1, profile: { __typename: "Profile", age: 30 } },
    fragment,
    createFragmentMatcher(new InMemoryCache()),
    "UserFields"
  );

  expect(data).toEqual({
    __typename: "User",
    id: 1,
    profile: { __typename: "Profile" },
  });
});

test("does not mask inline fragment in fragment documents", () => {
  const fragment = gql`
    fragment UserFields on User {
      __typename
      id
      ... @defer {
        age
      }
    }
  `;

  const data = maskFragment(
    { __typename: "User", id: 1, age: 30 },
    fragment,
    createFragmentMatcher(new InMemoryCache()),
    "UserFields"
  );

  expect(data).toEqual({ __typename: "User", id: 1, age: 30 });
});

test("throws when document contains more than 1 fragment without a fragmentName", () => {
  const fragment = gql`
    fragment UserFields on User {
      __typename
      id
      ...UserProfile
    }

    fragment UserProfile on User {
      age
    }
  `;

  expect(() =>
    maskFragment(
      { __typename: "User", id: 1, age: 30 },
      fragment,
      createFragmentMatcher(new InMemoryCache())
    )
  ).toThrow(
    new InvariantError(
      "Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment."
    )
  );
});

test("throws when fragment cannot be found within document", () => {
  const fragment = gql`
    fragment UserFields on User {
      __typename
      id
      ...UserProfile
    }

    fragment UserProfile on User {
      age
    }
  `;

  expect(() =>
    maskFragment(
      { __typename: "User", id: 1, age: 30 },
      fragment,
      createFragmentMatcher(new InMemoryCache()),
      "ProfileFields"
    )
  ).toThrow(
    new InvariantError('Could not find fragment with name "ProfileFields".')
  );
});

test("maintains referential equality on fragment subtrees that did not change", () => {
  const fragment = gql`
    fragment UserFields on User {
      __typename
      id
      profile {
        __typename
        ...ProfileFields
      }
      post {
        __typename
        id
        title
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
      drinks {
        __typename
        ... on SportsDrink {
          ...SportsDrinkFields
        }
        ... on Espresso {
          __typename
        }
      }
    }

    fragment ProfileFields on Profile {
      age
    }

    fragment FinanceIndustryFields on FinanceIndustry {
      yearsInBusiness
    }

    fragment TradeIndustryFields on TradeIndustry {
      languageRequirements
    }

    fragment SportsDrinkFields on SportsDrink {
      saltContent
    }
  `;

  const profile = {
    __typename: "Profile",
    age: 30,
  };
  const post = { __typename: "Post", id: 1, title: "Test Post" };
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
  const drinks = [
    { __typename: "Espresso" },
    { __typename: "SportsDrink", saltContent: "1000mg" },
  ];
  const user = deepFreeze({
    __typename: "User",
    id: 1,
    profile,
    post,
    industries,
    drinks,
  });

  const data = maskFragment(
    user,
    fragment,
    createFragmentMatcher(new InMemoryCache()),
    "UserFields"
  );

  expect(data).toEqual({
    __typename: "User",
    id: 1,
    profile: { __typename: "Profile" },
    post: { __typename: "Post", id: 1, title: "Test Post" },
    industries: [
      { __typename: "TechIndustry", languageRequirements: ["TypeScript"] },
      { __typename: "FinanceIndustry" },
      { __typename: "TradeIndustry", id: 10, yearsInBusiness: 15 },
    ],
    drinks: [{ __typename: "Espresso" }, { __typename: "SportsDrink" }],
  });

  expect(data).not.toBe(user);
  expect(data.profile).not.toBe(profile);
  expect(data.post).toBe(post);
  expect(data.industries).not.toBe(industries);
  expect(data.industries[0]).toBe(industries[0]);
  expect(data.industries[1]).not.toBe(industries[1]);
  expect(data.industries[2]).not.toBe(industries[2]);
  expect(data.drinks).not.toBe(drinks);
  expect(data.drinks[0]).toBe(drinks[0]);
  expect(data.drinks[1]).not.toBe(drinks[1]);
});

test("maintains referential equality on fragment when no data is masked", () => {
  const fragment = gql`
    fragment UserFields on User {
      __typename
      id
      age
    }
  `;

  const user = { __typename: "User", id: 1, age: 30 };

  const data = maskFragment(
    user,
    fragment,
    createFragmentMatcher(new InMemoryCache())
  );

  expect(data).toBe(user);
});

function createFragmentMatcher(cache: InMemoryCache) {
  return (node: InlineFragmentNode, typename: string) =>
    cache.policies.fragmentMatches(node, typename);
}
