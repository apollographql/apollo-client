import { maskFragment, maskOperation } from "../masking.js";
import { InMemoryCache, gql } from "../index.js";
import { InlineFragmentNode } from "graphql";
import { deepFreeze } from "../../utilities/common/maybeDeepFreeze.js";
import { InvariantError } from "../../utilities/globals/index.js";
import { spyOnConsole, withProdMode } from "../../testing/internal/index.js";

describe("maskOperation", () => {
  test("throws when passing document with no operation to maskOperation", () => {
    const document = gql`
      fragment Foo on Bar {
        foo
      }
    `;

    expect(() =>
      maskOperation({}, document, createFragmentMatcher(new InMemoryCache()))
    ).toThrow(
      new InvariantError(
        "Expected a parsed GraphQL document with a query, mutation, or subscription."
      )
    );
  });

  test("throws when passing string query to maskOperation", () => {
    const document = `
    query Foo {
      foo
    }
  `;

    expect(() =>
      maskOperation(
        {},
        // @ts-expect-error
        document,
        createFragmentMatcher(new InMemoryCache())
      )
    ).toThrow(
      new InvariantError(
        'Expecting a parsed GraphQL document. Perhaps you need to wrap the query string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql'
      )
    );
  });

  test("throws when passing multiple operations to maskOperation", () => {
    const document = gql`
      query Foo {
        foo
      }

      query Bar {
        bar
      }
    `;

    expect(() =>
      maskOperation({}, document, createFragmentMatcher(new InMemoryCache()))
    ).toThrow(
      new InvariantError("Ambiguous GraphQL document: contains 2 operations")
    );
  });

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

    const data = maskOperation(
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

    const data = maskOperation(
      deepFreeze({ user: { __typename: "User", id: 1, name: "Test User" } }),
      query,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toEqual({ user: { __typename: "User", id: 1 } });
  });

  test("deep freezes the masked result if the original data is frozen", () => {
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

    const frozenData = maskOperation(
      deepFreeze({ user: { __typename: "User", id: 1, name: "Test User" } }),
      query,
      createFragmentMatcher(new InMemoryCache())
    );

    const nonFrozenData = maskOperation(
      { user: { __typename: "User", id: 1, name: "Test User" } },
      query,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(Object.isFrozen(frozenData)).toBe(true);
    expect(Object.isFrozen(nonFrozenData)).toBe(false);
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

    const data = maskOperation(
      deepFreeze({
        users: [
          { __typename: "User", id: 1, name: "Test User 1" },
          { __typename: "User", id: 2, name: "Test User 2" },
        ],
      }),
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

    const data = maskOperation(
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

    const data = maskOperation(
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

    const data = maskOperation(
      deepFreeze({
        user: {
          __typename: "User",
          id: 1,
          birthdate: "1990-01-01",
          name: "Test User",
        },
      }),
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

    const data = maskOperation(
      deepFreeze({
        user: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
        profile: {
          __typename: "UserProfile",
          avatarUrl: "https://example.com/avatar.jpg",
        },
      }),
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

    const data = maskOperation(
      deepFreeze({
        user: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
        profile: {
          __typename: "UserProfile",
          avatarUrl: "https://example.com/avatar.jpg",
          industry: {
            __typename: "TechIndustry",
            primaryLanguage: "TypeScript",
          },
        },
      }),
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

    const data = maskOperation(
      deepFreeze({
        drinks: [
          { __typename: "HotChocolate", id: 1 },
          { __typename: "Juice", id: 2, fruitBase: "Strawberry" },
        ],
      }),
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

    const data = maskOperation(
      deepFreeze({
        user: {
          __typename: "User",
          id: 1,
          fullName: "Test User",
          userAddress: "1234 Main St",
        },
      }),
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

    const data = maskOperation(
      deepFreeze({
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
      }),
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

    const data = maskOperation(
      deepFreeze({ user: { __typename: "User", id: 1, name: "Test User" } }),
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

    const data = maskOperation(
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

    const data = maskOperation(
      originalData,
      query,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toBe(originalData);
  });

  test("does not mask named fragment fields and returns original object when using `@unmask` directive", () => {
    const query = gql`
      query UnmaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask
          __typename
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const queryData = deepFreeze({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });

    const data = maskOperation(
      queryData,
      query,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toBe(queryData);
  });

  test("maintains referential equality on subtrees that contain @unmask", () => {
    const query = gql`
      query {
        user {
          __typename
          id
          profile {
            __typename
            avatarUrl
          }
          ...UserFields @unmask
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
            ...TechIndustryFields @unmask
          }
          ... on FinanceIndustry {
            ...FinanceIndustryFields
          }
          ... on TradeIndustry {
            id
            yearsInBusiness
            ...TradeIndustryFields @unmask
          }
        }
      }

      fragment UserFields on User {
        name
        ...UserSubfields @unmask
      }

      fragment UserSubfields on User {
        age
      }

      fragment FinanceIndustryFields on FinanceIndustry {
        yearsInBusiness
      }

      fragment TradeIndustryFields on TradeIndustry {
        languageRequirements
      }

      fragment TechIndustryFields on TechIndustry {
        languageRequirements
        ...TechIndustrySubFields
      }

      fragment TechIndustrySubFields on TechIndustry {
        focus
      }
    `;

    const profile = {
      __typename: "Profile",
      avatarUrl: "https://example.com/avatar.jpg",
    };
    const user = {
      __typename: "User",
      id: 1,
      name: "Test User",
      profile,
      age: 30,
    };
    const post = { __typename: "Post", id: 1, title: "Test Post" };
    const authors = [{ __typename: "Author", id: 1, name: "A Author" }];
    const industries = [
      {
        __typename: "TechIndustry",
        languageRequirements: ["TypeScript"],
        focus: "innovation",
      },
      { __typename: "FinanceIndustry", yearsInBusiness: 10 },
      {
        __typename: "TradeIndustry",
        id: 10,
        yearsInBusiness: 15,
        languageRequirements: ["English", "German"],
      },
    ];
    const originalData = deepFreeze({ user, post, authors, industries });

    const data = maskOperation(
      originalData,
      query,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toEqual({
      user: {
        __typename: "User",
        name: "Test User",
        id: 1,
        profile: {
          __typename: "Profile",
          avatarUrl: "https://example.com/avatar.jpg",
        },
        age: 30,
      },
      post: { __typename: "Post", id: 1, title: "Test Post" },
      authors: [{ __typename: "Author", id: 1, name: "A Author" }],
      industries: [
        { __typename: "TechIndustry", languageRequirements: ["TypeScript"] },
        { __typename: "FinanceIndustry" },
        {
          __typename: "TradeIndustry",
          id: 10,
          yearsInBusiness: 15,
          languageRequirements: ["English", "German"],
        },
      ],
    });

    expect(data).not.toBe(originalData);
    expect(data.user).toBe(user);
    expect(data.user.profile).toBe(profile);
    expect(data.post).toBe(post);
    expect(data.authors).toBe(authors);
    expect(data.industries).not.toBe(industries);
    expect(data.industries[0]).not.toBe(industries[0]);
    expect(data.industries[1]).not.toBe(industries[1]);
    expect(data.industries[2]).toBe(industries[2]);
  });

  test("warns when accessing unmasked fields when using `@unmask` directive with mode 'migrate'", () => {
    using _ = spyOnConsole("warn");
    const query = gql`
      query UnmaskedQuery {
        currentUser {
          __typename
          id
          name
          ...UserFields @unmask(mode: "migrate")
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const anonymousQuery = gql`
      query {
        currentUser {
          __typename
          id
          name
          ...UserFields @unmask(mode: "migrate")
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

    const data = maskOperation(
      deepFreeze({ currentUser }),
      query,
      fragmentMatcher
    );

    const dataFromAnonymous = maskOperation(
      { currentUser },
      anonymousQuery,
      fragmentMatcher
    );

    data.currentUser.age;

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.age"
    );

    dataFromAnonymous.currentUser.age;

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "anonymous query",
      "currentUser.age"
    );

    data.currentUser.age;
    dataFromAnonymous.currentUser.age;

    // Ensure we only warn once for each masked field
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  test("does not warn when accessing unmasked fields when using `@unmask` directive with mode 'migrate' in non-DEV mode", () => {
    using _ = withProdMode();
    using __ = spyOnConsole("warn");

    const query = gql`
      query UnmaskedQuery {
        currentUser {
          __typename
          id
          name
          ...UserFields @unmask(mode: "migrate")
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const data = maskOperation(
      deepFreeze({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      }),
      query,
      createFragmentMatcher(new InMemoryCache())
    );

    const age = data.currentUser.age;

    expect(age).toBe(30);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("warns when accessing unmasked fields in arrays with mode: 'migrate'", () => {
    using _ = spyOnConsole("warn");
    const query = gql`
      query UnmaskedQuery {
        users {
          __typename
          id
          name
          ...UserFields @unmask(mode: "migrate")
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const fragmentMatcher = createFragmentMatcher(new InMemoryCache());

    const data = maskOperation(
      deepFreeze({
        users: [
          { __typename: "User", id: 1, name: "John Doe", age: 30 },
          { __typename: "User", id: 2, name: "Jane Doe", age: 30 },
        ],
      }),
      query,
      fragmentMatcher
    );

    data.users[0].age;
    data.users[1].age;

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "users[0].age"
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "users[1].age"
    );
  });

  test("can mix and match masked vs unmasked fragment fields with proper warnings", () => {
    using _ = spyOnConsole("warn");

    const query = gql`
      query UnmaskedQuery {
        currentUser {
          __typename
          id
          name
          ...UserFields @unmask
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
        skills {
          __typename
          name
          ...SkillFields @unmask(mode: "migrate")
        }
      }

      fragment ProfileFields on Profile {
        settings {
          __typename
          darkMode
        }
      }

      fragment SkillFields on Skill {
        description
      }
    `;

    const data = maskOperation(
      deepFreeze({
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
          skills: [
            {
              __typename: "Skill",
              name: "Skill 1",
              description: "Skill 1 description",
            },
            {
              __typename: "Skill",
              name: "Skill 2",
              description: "Skill 2 description",
            },
          ],
        },
      }),
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
        },
        skills: [
          {
            __typename: "Skill",
            name: "Skill 1",
            description: "Skill 1 description",
          },
          {
            __typename: "Skill",
            name: "Skill 2",
            description: "Skill 2 description",
          },
        ],
      },
    });

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.skills[0].description"
    );
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.skills[1].description"
    );
  });

  test("masks child fragments of @unmask(mode: 'migrate')", () => {
    using _ = spyOnConsole("warn");

    const query = gql`
      query UnmaskedQuery {
        currentUser {
          __typename
          id
          name
          ...UserFields @unmask(mode: "migrate")
        }
      }

      fragment UserFields on User {
        age
        ...UserSubfields
        ...UserSubfields2 @unmask
      }

      fragment UserSubfields on User {
        username
      }

      fragment UserSubfields2 on User {
        email
      }
    `;

    const data = maskOperation(
      deepFreeze({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
          username: "testuser",
          email: "test@example.com",
        },
      }),
      query,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
        email: "test@example.com",
      },
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.age"
    );
  });

  test("warns when accessing unmasked fields with complex selections with mode: 'migrate'", () => {
    using _ = spyOnConsole("warn");
    const query = gql`
      query UnmaskedQuery {
        currentUser {
          __typename
          id
          name
          ...UserFields @unmask(mode: "migrate")
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
          ...ProfileFields @unmask(mode: "migrate")
        }
        skills {
          __typename
          name
          ...SkillFields @unmask(mode: "migrate")
        }
      }

      fragment ProfileFields on Profile {
        settings {
          __typename
          dark: darkMode
        }
      }

      fragment SkillFields on Skill {
        description
      }
    `;

    const currentUser = {
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
          dark: true,
        },
      },
      skills: [
        {
          __typename: "Skill",
          name: "Skill 1",
          description: "Skill 1 description",
        },
        {
          __typename: "Skill",
          name: "Skill 2",
          description: "Skill 2 description",
        },
      ],
    };

    const fragmentMatcher = createFragmentMatcher(new InMemoryCache());

    const data = maskOperation(
      deepFreeze({ currentUser }),
      query,
      fragmentMatcher
    );

    data.currentUser.age;
    data.currentUser.profile.email;
    data.currentUser.profile.username;
    data.currentUser.profile.settings;
    data.currentUser.profile.settings.dark;
    data.currentUser.skills[0].description;
    data.currentUser.skills[1].description;

    expect(console.warn).toHaveBeenCalledTimes(9);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.age"
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.profile"
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.profile.email"
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.profile.username"
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.profile.settings"
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.profile.settings.dark"
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.skills"
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.skills[0].description"
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "query 'UnmaskedQuery'",
      "currentUser.skills[1].description"
    );
  });

  test("does not warn when accessing fields shared between the query and fragment with mode: 'migrate'", () => {
    using _ = spyOnConsole("warn");
    const query = gql`
      query UnmaskedQuery {
        currentUser {
          __typename
          id
          name
          age
          ...UserFields @unmask(mode: "migrate")
          email
        }
      }

      fragment UserFields on User {
        age
        email
      }
    `;

    const fragmentMatcher = createFragmentMatcher(new InMemoryCache());

    const data = maskOperation(
      deepFreeze({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
          email: "testuser@example.com",
        },
      }),
      query,
      fragmentMatcher
    );

    data.currentUser.age;
    data.currentUser.email;

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("does not warn accessing fields with `@unmask` without mode argument", () => {
    using _ = spyOnConsole("warn");
    const query = gql`
      query UnmaskedQuery {
        currentUser {
          __typename
          id
          name
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const fragmentMatcher = createFragmentMatcher(new InMemoryCache());

    const data = maskOperation(
      deepFreeze({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      }),
      query,
      fragmentMatcher
    );

    data.currentUser.age;

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("masks fragments in subscription documents", () => {
    const subscription = gql`
      subscription {
        onUserUpdated {
          __typename
          id
          ...UserFields
        }
      }

      fragment UserFields on User {
        name
      }
    `;

    const data = maskOperation(
      deepFreeze({
        onUserUpdated: { __typename: "User", id: 1, name: "Test User" },
      }),
      subscription,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toEqual({ onUserUpdated: { __typename: "User", id: 1 } });
  });

  test("honors @unmask used in subscription documents", () => {
    const subscription = gql`
      subscription {
        onUserUpdated {
          __typename
          id
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        name
      }
    `;

    const subscriptionData = deepFreeze({
      onUserUpdated: { __typename: "User", id: 1, name: "Test User" },
    });

    const data = maskOperation(
      subscriptionData,
      subscription,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toBe(subscriptionData);
  });

  test("warns when accessing unmasked fields used in subscription documents with @unmask(mode: 'migrate')", () => {
    using _ = spyOnConsole("warn");

    const subscription = gql`
      subscription UserUpdatedSubscription {
        onUserUpdated {
          __typename
          id
          ...UserFields @unmask(mode: "migrate")
        }
      }

      fragment UserFields on User {
        name
      }
    `;

    const subscriptionData = deepFreeze({
      onUserUpdated: { __typename: "User", id: 1, name: "Test User" },
    });

    const data = maskOperation(
      subscriptionData,
      subscription,
      createFragmentMatcher(new InMemoryCache())
    );

    data.onUserUpdated.name;

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "subscription 'UserUpdatedSubscription'",
      "onUserUpdated.name"
    );
  });

  test("masks fragments in mutation documents", () => {
    const mutation = gql`
      mutation {
        updateUser {
          __typename
          id
          ...UserFields
        }
      }

      fragment UserFields on User {
        name
      }
    `;

    const data = maskOperation(
      deepFreeze({
        updateUser: { __typename: "User", id: 1, name: "Test User" },
      }),
      mutation,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toEqual({ updateUser: { __typename: "User", id: 1 } });
  });

  test("honors @unmask used in mutation documents", () => {
    const mutation = gql`
      mutation {
        updateUser {
          __typename
          id
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        name
      }
    `;

    const mutationData = deepFreeze({
      updateUser: { __typename: "User", id: 1, name: "Test User" },
    });

    const data = maskOperation(
      mutationData,
      mutation,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toBe(mutationData);
  });

  test("warns when accessing unmasked fields used in mutation documents with @unmask(mode: 'migrate')", () => {
    using _ = spyOnConsole("warn");

    const mutation = gql`
      mutation UpdateUserMutation {
        updateUser {
          __typename
          id
          ...UserFields @unmask(mode: "migrate")
        }
      }

      fragment UserFields on User {
        name
      }
    `;

    const mutationData = deepFreeze({
      updateUser: { __typename: "User", id: 1, name: "Test User" },
    });

    const data = maskOperation(
      mutationData,
      mutation,
      createFragmentMatcher(new InMemoryCache())
    );

    data.updateUser.name;

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "mutation 'UpdateUserMutation'",
      "updateUser.name"
    );
  });
});

describe("maskFragment", () => {
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
      deepFreeze({ __typename: "User", id: 1, age: 30 }),
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
      deepFreeze({
        __typename: "User",
        id: 1,
        profile: { __typename: "Profile", age: 30 },
      }),
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

  test("deep freezes the masked result if the original data is frozen", () => {
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

    const frozenData = maskFragment(
      deepFreeze({
        __typename: "User",
        id: 1,
        profile: { __typename: "Profile", age: 30 },
      }),
      fragment,
      createFragmentMatcher(new InMemoryCache()),
      "UserFields"
    );

    const nonFrozenData = maskFragment(
      {
        __typename: "User",
        id: 1,
        profile: { __typename: "Profile", age: 30 },
      },
      fragment,
      createFragmentMatcher(new InMemoryCache()),
      "UserFields"
    );

    expect(Object.isFrozen(frozenData)).toBe(true);
    expect(Object.isFrozen(nonFrozenData)).toBe(false);
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
      deepFreeze({ __typename: "User", id: 1, age: 30 }),
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
        deepFreeze({ __typename: "User", id: 1, age: 30 }),
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
        deepFreeze({ __typename: "User", id: 1, age: 30 }),
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
      deepFreeze(user),
      fragment,
      createFragmentMatcher(new InMemoryCache())
    );

    expect(data).toBe(user);
  });

  test("does not mask named fragments and returns original object when using `@unmask` directive", () => {
    const fragment = gql`
      fragment UnmaskedFragment on User {
        id
        name
        ...UserFields @unmask
        __typename
      }

      fragment UserFields on User {
        age
      }
    `;

    const fragmentData = deepFreeze({
      __typename: "User",
      id: 1,
      name: "Test User",
      age: 30,
    });

    const data = maskFragment(
      fragmentData,
      fragment,
      createFragmentMatcher(new InMemoryCache()),
      "UnmaskedFragment"
    );

    expect(data).toBe(fragmentData);
  });

  test("warns when accessing unmasked fields when using `@unmask` directive with mode 'migrate'", () => {
    using _ = spyOnConsole("warn");
    const query = gql`
      fragment UnmaskedFragment on User {
        __typename
        id
        name
        ...UserFields @unmask(mode: "migrate")
      }

      fragment UserFields on User {
        age
      }
    `;

    const fragmentMatcher = createFragmentMatcher(new InMemoryCache());

    const data = maskFragment(
      deepFreeze({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      }),
      query,
      fragmentMatcher,
      "UnmaskedFragment"
    );

    data.age;

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "fragment 'UnmaskedFragment'",
      "age"
    );

    data.age;

    // Ensure we only warn once for each masked field
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  test("maintains referential equality on `@unmask` fragment subtrees", () => {
    const fragment = gql`
      fragment UserFields on User {
        __typename
        id
        profile {
          __typename
          ...ProfileFields @unmask
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
            ...SportsDrinkFields @unmask
          }
          ... on Espresso {
            __typename
          }
        }
      }

      fragment ProfileFields on Profile {
        age
        ...ProfileSubfields @unmask
      }

      fragment ProfileSubfields on Profile {
        name
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
      name: "Test User",
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
      profile: { __typename: "Profile", age: 30, name: "Test User" },
      post: { __typename: "Post", id: 1, title: "Test Post" },
      industries: [
        { __typename: "TechIndustry", languageRequirements: ["TypeScript"] },
        { __typename: "FinanceIndustry" },
        { __typename: "TradeIndustry", id: 10, yearsInBusiness: 15 },
      ],
      drinks: [
        { __typename: "Espresso" },
        { __typename: "SportsDrink", saltContent: "1000mg" },
      ],
    });

    expect(data).not.toBe(user);
    expect(data.profile).toBe(profile);
    expect(data.post).toBe(post);
    expect(data.industries).not.toBe(industries);
    expect(data.industries[0]).toBe(industries[0]);
    expect(data.industries[1]).not.toBe(industries[1]);
    expect(data.industries[2]).not.toBe(industries[2]);
    expect(data.drinks).toBe(drinks);
    expect(data.drinks[0]).toBe(drinks[0]);
    expect(data.drinks[1]).toBe(drinks[1]);
  });

  test("masks child fragments of @unmask(mode: 'migrate')", () => {
    using _ = spyOnConsole("warn");

    const fragment = gql`
      fragment UnmaskedUser on User {
        __typename
        id
        name
        ...UserFields @unmask(mode: "migrate")
      }

      fragment UserFields on User {
        age
        ...UserSubfields
        ...UserSubfields2 @unmask
      }

      fragment UserSubfields on User {
        username
      }

      fragment UserSubfields2 on User {
        email
      }
    `;

    const data = maskFragment(
      deepFreeze({
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
        username: "testuser",
        email: "test@example.com",
      }),
      fragment,
      createFragmentMatcher(new InMemoryCache()),
      "UnmaskedUser"
    );

    expect(data).toEqual({
      __typename: "User",
      id: 1,
      name: "Test User",
      age: 30,
      email: "test@example.com",
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "fragment 'UnmaskedUser'",
      "age"
    );
  });
});

function createFragmentMatcher(cache: InMemoryCache) {
  return (node: InlineFragmentNode, typename: string) =>
    cache.policies.fragmentMatches(node, typename);
}
