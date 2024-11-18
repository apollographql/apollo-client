import { maskFragment, maskOperation } from "../masking.js";
import { InMemoryCache, gql } from "../index.js";
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

    expect(() => maskOperation({}, document, new InMemoryCache())).toThrow(
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
        new InMemoryCache()
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

    expect(() => maskOperation({}, document, new InMemoryCache())).toThrow(
      new InvariantError("Ambiguous GraphQL document: contains 2 operations")
    );
  });

  test("returns null when data is null", () => {
    const query = gql`
      query {
        foo
        ...QueryFields
      }

      fragment QueryFields on Query {
        bar
      }
    `;

    const data = maskOperation(null, query, new InMemoryCache());

    expect(data).toBe(null);
  });

  test("returns undefined when data is undefined", () => {
    const query = gql`
      query {
        foo
        ...QueryFields
      }

      fragment QueryFields on Query {
        bar
      }
    `;

    const data = maskOperation(undefined, query, new InMemoryCache());

    expect(data).toBe(undefined);
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
      new InMemoryCache()
    );

    expect(data).toEqual({ foo: true });
  });

  test("strips fragment data from nested object", () => {
    const query = gql`
      query {
        user {
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
      new InMemoryCache()
    );

    expect(data).toEqual({ user: { __typename: "User", id: 1 } });
  });

  test("retains __typename in the result", () => {
    const query = gql`
      query {
        user {
          id
          profile {
            id
          }
          ...UserFields
        }
      }

      fragment UserFields on Query {
        age
      }
    `;

    const data = maskOperation(
      deepFreeze({
        user: {
          __typename: "User",
          id: 1,
          age: 30,
          profile: { __typename: "Profile", id: 2 },
        },
      }),
      query,
      new InMemoryCache()
    );

    expect(data).toEqual({
      user: {
        __typename: "User",
        id: 1,
        profile: { __typename: "Profile", id: 2 },
      },
    });
  });

  test("masks fragments from nested objects when query gets fields from same object", () => {
    const query = gql`
      query {
        user {
          profile {
            __typename
            id
          }
          ...UserFields
        }
      }
      fragment UserFields on User {
        profile {
          id
          fullName
        }
      }
    `;

    const data = maskOperation(
      deepFreeze({
        user: {
          __typename: "User",
          profile: { __typename: "Profile", id: "1", fullName: "Test User" },
        },
      }),
      query,
      new InMemoryCache()
    );

    expect(data).toEqual({
      user: {
        __typename: "User",
        profile: { __typename: "Profile", id: "1" },
      },
    });
  });

  test("handles nulls in child selection sets", () => {
    const query = gql`
      query {
        user {
          profile {
            id
          }
          ...UserFields
        }
      }
      fragment UserFields on User {
        profile {
          id
          fullName
        }
      }
    `;

    const nullUser = maskOperation(
      deepFreeze({ user: null }),
      query,
      new InMemoryCache()
    );
    const nullProfile = maskOperation(
      deepFreeze({ user: { __typename: "User", profile: null } }),
      query,
      new InMemoryCache()
    );

    expect(nullUser).toEqual({ user: null });
    expect(nullProfile).toEqual({
      user: { __typename: "User", profile: null },
    });
  });

  test("handles nulls in arrays", () => {
    const query = gql`
      query {
        users {
          profile {
            id
          }
          ...UserFields
        }
      }
      fragment UserFields on User {
        profile {
          id
          fullName
        }
      }
    `;

    const data = maskOperation(
      deepFreeze({
        users: [
          null,
          { __typename: "User", profile: null },
          {
            __typename: "User",
            profile: { __typename: "Profile", id: "1", fullName: "Test User" },
          },
        ],
      }),
      query,
      new InMemoryCache()
    );

    expect(data).toEqual({
      users: [
        null,
        { __typename: "User", profile: null },
        { __typename: "User", profile: { __typename: "Profile", id: "1" } },
      ],
    });
  });

  test("deep freezes the masked result if the original data is frozen", () => {
    const query = gql`
      query {
        user {
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
      new InMemoryCache()
    );

    const nonFrozenData = maskOperation(
      { user: { __typename: "User", id: 1, name: "Test User" } },
      query,
      new InMemoryCache()
    );

    expect(Object.isFrozen(frozenData)).toBe(true);
    expect(Object.isFrozen(nonFrozenData)).toBe(false);
  });

  test("strips fragment data from arrays", () => {
    const query = gql`
      query {
        users {
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
      new InMemoryCache()
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
      new InMemoryCache()
    );

    expect(data).toEqual({
      user: { __typename: "User", id: 1 },
    });
  });

  test("strips multiple fragments across different selection sets", () => {
    const query = gql`
      query {
        user {
          id
          ...UserFields
        }
        post {
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
      new InMemoryCache()
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
      new InMemoryCache()
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
          id
          ... @defer {
            name
          }
        }
        profile {
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
      cache
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
          id
          ... @defer {
            name
            ...UserFields
          }
        }
        profile {
          ... on UserProfile {
            avatarUrl
            ...UserProfileFields
          }
          industry {
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
      cache
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
      cache
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
      new InMemoryCache()
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
          id
          ... @defer {
            amount
          }
          ... on Espresso {
            milkType
            ... on Latte {
              flavor {
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
      cache
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
          id
          name
        }
      }
    `;

    const data = maskOperation(
      deepFreeze({ user: { __typename: "User", id: 1, name: "Test User" } }),
      query,
      new InMemoryCache()
    );

    expect(data).toEqual({
      user: { __typename: "User", id: 1, name: "Test User" },
    });
  });

  test("maintains referential equality on subtrees that did not change", () => {
    const query = gql`
      query {
        user {
          id
          profile {
            avatarUrl
          }
          ...UserFields
        }
        post {
          id
          title
        }
        authors {
          id
          name
        }
        industries {
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

    const data = maskOperation(originalData, query, new InMemoryCache());

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

    const data = maskOperation(originalData, query, new InMemoryCache());

    expect(data).toBe(originalData);
  });

  test("does not mask named fragment fields and returns original object when using `@unmask` directive", () => {
    const query = gql`
      query UnmaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask
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

    const data = maskOperation(queryData, query, new InMemoryCache());

    expect(data).toBe(queryData);
  });

  test("maintains referential equality on subtrees that contain @unmask", () => {
    const query = gql`
      query {
        user {
          id
          profile {
            avatarUrl
          }
          ...UserFields @unmask
        }
        post {
          id
          title
        }
        authors {
          id
          name
        }
        industries {
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

    const data = maskOperation(originalData, query, new InMemoryCache());

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

    const cache = new InMemoryCache();

    const data = maskOperation(deepFreeze({ currentUser }), query, cache);

    const dataFromAnonymous = maskOperation(
      { currentUser },
      anonymousQuery,
      cache
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
      new InMemoryCache()
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
        users: [
          { __typename: "User", id: 1, name: "John Doe", age: 30 },
          { __typename: "User", id: 2, name: "Jane Doe", age: 30 },
        ],
      }),
      query,
      new InMemoryCache()
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
          id
          name
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        age
        profile {
          email
          ... @defer {
            username
          }
          ...ProfileFields
        }
        skills {
          name
          ...SkillFields @unmask(mode: "migrate")
        }
      }

      fragment ProfileFields on Profile {
        settings {
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
      new InMemoryCache()
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
      new InMemoryCache()
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
          id
          name
          ...UserFields @unmask(mode: "migrate")
        }
      }

      fragment UserFields on User {
        age
        profile {
          email
          ... @defer {
            username
          }
          ...ProfileFields @unmask(mode: "migrate")
        }
        skills {
          name
          ...SkillFields @unmask(mode: "migrate")
        }
      }

      fragment ProfileFields on Profile {
        settings {
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

    const data = maskOperation(
      deepFreeze({ currentUser }),
      query,
      new InMemoryCache()
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
      new InMemoryCache()
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
          id
          name
          ...UserFields @unmask
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
      new InMemoryCache()
    );

    data.currentUser.age;

    expect(console.warn).not.toHaveBeenCalled();
  });

  // https://github.com/apollographql/apollo-client/issues/12127
  test('handles interface types when using @unmask(mode: "migrate")', async () => {
    using _ = spyOnConsole("warn");
    const query = gql`
      query PlaybackStateSubscriberQuery {
        playbackState {
          __typename
          ...PlaybackStateFragment @unmask(mode: "migrate")
        }
      }

      fragment PlaybackStateFragment on PlaybackState {
        item {
          __typename
          id

          ... on Track {
            album {
              __typename
              id
            }
          }

          ... on Episode {
            show {
              __typename
              id
            }
          }
        }
      }
    `;

    const data = maskOperation(
      {
        playbackState: {
          __typename: "PlaybackState",
          item: {
            __typename: "Track",
            id: "1",
            album: {
              __typename: "Album",
              id: "2",
            },
          },
        },
      },
      query,
      new InMemoryCache()
    );

    expect(data).toEqual({
      playbackState: {
        __typename: "PlaybackState",
        item: {
          __typename: "Track",
          id: "1",
          album: {
            __typename: "Album",
            id: "2",
          },
        },
      },
    });
  });

  test('handles overlapping types when subtype has accessor warnings with @unmask(mode: "migrate")', async () => {
    using consoleSpy = spyOnConsole("warn");
    const query = gql`
      query PlaylistQuery {
        playlist {
          ...PlaylistFragment @unmask(mode: "migrate")
          id
          name
          album {
            id
            tracks {
              id
              __typename
            }
            __typename
          }
          artist {
            id
            topTracks {
              id
              __typename
            }
            __typename
          }
          __typename

          ...PlaylistTitleCell @unmask(mode: "migrate")
        }
      }

      fragment PlaylistFragment on Playlist {
        album {
          id
          images {
            url
            __typename
          }
          tracks {
            id
            name
            __typename
          }
          __typename
        }
      }

      fragment PlaylistTitleCell on Playlist {
        artist {
          id
          images {
            url
            __typename
          }
          topTracks {
            id
            name
            __typename
          }
          __typename
        }
      }
    `;

    const data = maskOperation(
      {
        playlist: {
          id: "1",
          name: "Playlist",
          album: {
            id: "2RSIoPew2TOy41ASHpzOx3",
            __typename: "Album",
            images: [{ url: "https://i.scdn.co/image/1", __typename: "Image" }],
            tracks: [{ id: "1", name: "Track 1", __typename: "Track" }],
          },
          artist: {
            id: "2",
            __typename: "Artist",
            images: [{ url: "https://i.scdn.co/image/1", __typename: "Image" }],
            topTracks: [{ id: "2", name: "Track 2", __typename: "Track" }],
          },
        },
      },
      query,
      new InMemoryCache()
    );

    expect(consoleSpy.warn).not.toHaveBeenCalled();

    consoleSpy.warn.mockClear();

    data.playlist.album;
    data.playlist.album.id;
    data.playlist.album.__typename;
    data.playlist.artist;
    data.playlist.artist.id;
    data.playlist.artist.__typename;
    expect(console.warn).not.toHaveBeenCalled();

    data.playlist.album.images;
    data.playlist.artist.images;
    expect(console.warn).toHaveBeenCalledTimes(2);

    expect(data).toEqual({
      playlist: {
        id: "1",
        name: "Playlist",
        album: {
          id: "2RSIoPew2TOy41ASHpzOx3",
          __typename: "Album",
          images: [{ url: "https://i.scdn.co/image/1", __typename: "Image" }],
          tracks: [{ id: "1", name: "Track 1", __typename: "Track" }],
        },
        artist: {
          id: "2",
          __typename: "Artist",
          images: [{ url: "https://i.scdn.co/image/1", __typename: "Image" }],
          topTracks: [{ id: "2", name: "Track 2", __typename: "Track" }],
        },
      },
    });
  });

  test("masks fragments in subscription documents", () => {
    const subscription = gql`
      subscription {
        onUserUpdated {
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
      new InMemoryCache()
    );

    expect(data).toEqual({ onUserUpdated: { __typename: "User", id: 1 } });
  });

  test("honors @unmask used in subscription documents", () => {
    const subscription = gql`
      subscription {
        onUserUpdated {
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
      new InMemoryCache()
    );

    expect(data).toBe(subscriptionData);
  });

  test("warns when accessing unmasked fields used in subscription documents with @unmask(mode: 'migrate')", () => {
    using _ = spyOnConsole("warn");

    const subscription = gql`
      subscription UserUpdatedSubscription {
        onUserUpdated {
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
      new InMemoryCache()
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
      new InMemoryCache()
    );

    expect(data).toEqual({ updateUser: { __typename: "User", id: 1 } });
  });

  test("honors @unmask used in mutation documents", () => {
    const mutation = gql`
      mutation {
        updateUser {
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

    const data = maskOperation(mutationData, mutation, new InMemoryCache());

    expect(data).toBe(mutationData);
  });

  test("warns when accessing unmasked fields used in mutation documents with @unmask(mode: 'migrate')", () => {
    using _ = spyOnConsole("warn");

    const mutation = gql`
      mutation UpdateUserMutation {
        updateUser {
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

    const data = maskOperation(mutationData, mutation, new InMemoryCache());

    data.updateUser.name;

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
      "mutation 'UpdateUserMutation'",
      "updateUser.name"
    );
  });

  test("masks partial data", () => {
    const query = gql`
      query {
        greeting {
          message
          ...GreetingFragment
        }
      }

      fragment GreetingFragment on Greeting {
        sentAt
        recipient {
          name
        }
      }
    `;

    {
      const data = maskOperation(
        { greeting: { message: "Hello world", __typename: "Greeting" } },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: { message: "Hello world", __typename: "Greeting" },
      });
    }

    {
      const data = maskOperation(
        {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            sentAt: "2024-01-01",
          },
        },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
        },
      });
    }

    {
      const data = maskOperation(
        {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "__Person" },
          },
        },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
        },
      });
    }
  });

  test("unmasks partial data with @unmask", () => {
    const query = gql`
      query {
        greeting {
          message
          ...GreetingFragment @unmask
        }
      }

      fragment GreetingFragment on Greeting {
        sentAt
        recipient {
          name
        }
      }
    `;

    {
      const data = maskOperation(
        { greeting: { message: "Hello world", __typename: "Greeting" } },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: { message: "Hello world", __typename: "Greeting" },
      });
    }

    {
      const data = maskOperation(
        {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            sentAt: "2024-01-01",
          },
        },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          sentAt: "2024-01-01",
        },
      });
    }

    {
      const data = maskOperation(
        {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "__Person" },
          },
        },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "__Person" },
        },
      });
    }
  });

  // TODO: Remove .failing when refactoring migrate mode
  test.failing(
    'unmasks partial data with warnings with @unmask(mode: "migrate")',
    () => {
      using _ = spyOnConsole("warn");

      const query = gql`
        query {
          greeting {
            message
            ...GreetingFragment @unmask(mode: "migrate")
          }
        }

        fragment GreetingFragment on Greeting {
          sentAt
          recipient {
            name
          }
        }
      `;

      {
        const data = maskOperation(
          { greeting: { message: "Hello world", __typename: "Greeting" } },
          query,
          new InMemoryCache()
        );

        expect(data).toEqual({
          greeting: { message: "Hello world", __typename: "Greeting" },
        });
      }

      {
        const data = maskOperation(
          {
            greeting: {
              __typename: "Greeting",
              message: "Hello world",
              sentAt: "2024-01-01",
            },
          },
          query,
          new InMemoryCache()
        );

        data.greeting.__typename;
        data.greeting.message;

        expect(console.warn).not.toHaveBeenCalled();

        data.greeting.sentAt;
        expect(console.warn).toHaveBeenCalledTimes(1);

        expect(data).toEqual({
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            sentAt: "2024-01-01",
          },
        });
      }

      {
        const data = maskOperation(
          {
            greeting: {
              __typename: "Greeting",
              message: "Hello world",
              recipient: { __typename: "__Person" },
            },
          },
          query,
          new InMemoryCache()
        );

        data.greeting.__typename;
        data.greeting.message;

        expect(console.warn).not.toHaveBeenCalled();

        data.greeting.recipient;
        data.greeting.recipient.__typename;
        expect(console.warn).toHaveBeenCalledTimes(1);

        expect(data).toEqual({
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "__Person" },
          },
        });
      }
    }
  );

  test("masks partial deferred data", () => {
    const query = gql`
      query {
        greeting {
          message
          ... @defer {
            sentAt
            ...GreetingFragment
          }
        }
      }

      fragment GreetingFragment on Greeting {
        recipient {
          name
        }
      }
    `;

    {
      const data = maskOperation(
        { greeting: { message: "Hello world", __typename: "Greeting" } },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: { message: "Hello world", __typename: "Greeting" },
      });
    }

    {
      const data = maskOperation(
        {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            sentAt: "2024-01-01",
            recipient: { __typename: "__Person", name: "Alice" },
          },
        },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          sentAt: "2024-01-01",
        },
      });
    }
  });

  test("unmasks partial deferred data with @unmask", () => {
    const query = gql`
      query {
        greeting {
          message
          ... @defer {
            sentAt
            ...GreetingFragment @unmask
          }
        }
      }

      fragment GreetingFragment on Greeting {
        recipient {
          name
        }
      }
    `;

    {
      const data = maskOperation(
        { greeting: { message: "Hello world", __typename: "Greeting" } },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: { message: "Hello world", __typename: "Greeting" },
      });
    }

    {
      const data = maskOperation(
        {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            sentAt: "2024-01-01",
            recipient: { __typename: "__Person", name: "Alice" },
          },
        },
        query,
        new InMemoryCache()
      );

      expect(data).toEqual({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          sentAt: "2024-01-01",
          recipient: { __typename: "__Person", name: "Alice" },
        },
      });
    }
  });

  // TODO: Remove .failing when refactoring migrate mode
  test.failing(
    'unmasks partial deferred data with warnings with @unmask(mode: "migrate")',
    () => {
      using _ = spyOnConsole("warn");

      const query = gql`
        query {
          greeting {
            message
            ... @defer {
              sentAt
              ...GreetingFragment @unmask(mode: "migrate")
            }
          }
        }

        fragment GreetingFragment on Greeting {
          recipient {
            name
          }
        }
      `;

      {
        const data = maskOperation(
          { greeting: { message: "Hello world", __typename: "Greeting" } },
          query,
          new InMemoryCache()
        );

        expect(data).toEqual({
          greeting: { message: "Hello world", __typename: "Greeting" },
        });
      }

      {
        const data = maskOperation(
          {
            greeting: {
              __typename: "Greeting",
              message: "Hello world",
              sentAt: "2024-01-01",
              recipient: { __typename: "__Person", name: "Alice" },
            },
          },
          query,
          new InMemoryCache()
        );

        data.greeting.message;
        data.greeting.sentAt;
        data.greeting.__typename;

        expect(console.warn).not.toHaveBeenCalled();

        data.greeting.recipient;
        data.greeting.recipient.__typename;
        data.greeting.recipient.name;
        expect(console.warn).toHaveBeenCalledTimes(3);

        expect(data).toEqual({
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            sentAt: "2024-01-01",
            recipient: { __typename: "__Person", name: "Alice" },
          },
        });
      }
    }
  );
});

describe("maskFragment", () => {
  test("returns null when data is null", () => {
    const fragment = gql`
      fragment Foo on Query {
        foo
        ...QueryFields
      }

      fragment QueryFields on Query {
        bar
      }
    `;

    const data = maskFragment(null, fragment, new InMemoryCache(), "Foo");

    expect(data).toBe(null);
  });

  test("returns undefined when data is undefined", () => {
    const fragment = gql`
      fragment Foo on Query {
        foo
        ...QueryFields
      }

      fragment QueryFields on Query {
        bar
      }
    `;

    const data = maskFragment(undefined, fragment, new InMemoryCache(), "Foo");

    expect(data).toBe(undefined);
  });
  test("masks named fragments in fragment documents", () => {
    const fragment = gql`
      fragment UserFields on User {
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
      new InMemoryCache(),
      "UserFields"
    );

    expect(data).toEqual({ __typename: "User", id: 1 });
  });

  test("masks named fragments in nested fragment objects", () => {
    const fragment = gql`
      fragment UserFields on User {
        id
        profile {
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
      new InMemoryCache(),
      "UserFields"
    );

    expect(data).toEqual({
      __typename: "User",
      id: 1,
      profile: { __typename: "Profile" },
    });
  });

  test("handles nulls in child selection sets", () => {
    const fragment = gql`
      fragment UserFields on User {
        profile {
          id
        }
        ...ProfileFields
      }
      fragment ProfileFields on User {
        profile {
          id
          fullName
        }
      }
    `;

    const data = maskFragment(
      deepFreeze({ __typename: "User", profile: null }),
      fragment,
      new InMemoryCache(),
      "UserFields"
    );

    expect(data).toEqual({ __typename: "User", profile: null });
  });

  test("handles nulls in arrays", () => {
    const fragment = gql`
      fragment UserFields on Query {
        users {
          profile {
            id
          }
          ...ProfileFields
        }
      }
      fragment ProfileFields on User {
        profile {
          id
          fullName
        }
      }
    `;

    const data = maskFragment(
      deepFreeze({
        users: [
          null,
          { __typename: "User", profile: null },
          {
            __typename: "User",
            profile: { __typename: "Profile", id: "1", fullName: "Test User" },
          },
        ],
      }),
      fragment,
      new InMemoryCache(),
      "UserFields"
    );

    expect(data).toEqual({
      users: [
        null,
        { __typename: "User", profile: null },
        { __typename: "User", profile: { __typename: "Profile", id: "1" } },
      ],
    });
  });

  test("deep freezes the masked result if the original data is frozen", () => {
    const fragment = gql`
      fragment UserFields on User {
        id
        profile {
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
      new InMemoryCache(),
      "UserFields"
    );

    const nonFrozenData = maskFragment(
      {
        __typename: "User",
        id: 1,
        profile: { __typename: "Profile", age: 30 },
      },
      fragment,
      new InMemoryCache(),
      "UserFields"
    );

    expect(Object.isFrozen(frozenData)).toBe(true);
    expect(Object.isFrozen(nonFrozenData)).toBe(false);
  });

  test("does not mask inline fragment in fragment documents", () => {
    const fragment = gql`
      fragment UserFields on User {
        id
        ... @defer {
          age
        }
      }
    `;

    const data = maskFragment(
      deepFreeze({ __typename: "User", id: 1, age: 30 }),
      fragment,
      new InMemoryCache(),
      "UserFields"
    );

    expect(data).toEqual({ __typename: "User", id: 1, age: 30 });
  });

  test("throws when document contains more than 1 fragment without a fragmentName", () => {
    const fragment = gql`
      fragment UserFields on User {
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
        new InMemoryCache()
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
        new InMemoryCache(),
        "ProfileFields"
      )
    ).toThrow(
      new InvariantError('Could not find fragment with name "ProfileFields".')
    );
  });

  test("maintains referential equality on fragment subtrees that did not change", () => {
    const fragment = gql`
      fragment UserFields on User {
        id
        profile {
          ...ProfileFields
        }
        post {
          id
          title
        }
        industries {
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
      new InMemoryCache(),
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
        id
        age
      }
    `;

    const user = { __typename: "User", id: 1, age: 30 };

    const data = maskFragment(deepFreeze(user), fragment, new InMemoryCache());

    expect(data).toBe(user);
  });

  test("does not mask named fragments and returns original object when using `@unmask` directive", () => {
    const fragment = gql`
      fragment UnmaskedFragment on User {
        id
        name
        ...UserFields @unmask
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
      new InMemoryCache(),
      "UnmaskedFragment"
    );

    expect(data).toBe(fragmentData);
  });

  test("warns when accessing unmasked fields when using `@unmask` directive with mode 'migrate'", () => {
    using _ = spyOnConsole("warn");
    const fragment = gql`
      fragment UnmaskedFragment on User {
        id
        name
        ...UserFields @unmask(mode: "migrate")
      }

      fragment UserFields on User {
        age
      }
    `;

    const data = maskFragment(
      deepFreeze({
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      }),
      fragment,
      new InMemoryCache(),
      "UnmaskedFragment"
    );

    data.__typename;
    data.id;
    data.name;

    expect(console.warn).not.toHaveBeenCalled();

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
        id
        profile {
          ...ProfileFields @unmask
        }
        post {
          id
          title
        }
        industries {
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
      new InMemoryCache(),
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
      new InMemoryCache(),
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

  test("masks partial data", () => {
    const fragment = gql`
      fragment GreetingFields on Greeting {
        message
        ...AdditionalFields
      }

      fragment AdditionalFields on Greeting {
        sentAt
        recipient {
          name
        }
      }
    `;

    {
      const data = maskFragment(
        { message: "Hello world", __typename: "Greeting" },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        message: "Hello world",
        __typename: "Greeting",
      });
    }

    {
      const data = maskFragment(
        {
          __typename: "Greeting",
          message: "Hello world",
          sentAt: "2024-01-01",
        },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        __typename: "Greeting",
        message: "Hello world",
      });
    }

    {
      const data = maskFragment(
        {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "__Person" },
        },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        __typename: "Greeting",
        message: "Hello world",
      });
    }
  });

  test("unmasks partial data with @unmask", () => {
    const fragment = gql`
      fragment GreetingFields on Greeting {
        message
        ...AdditionalFields @unmask
      }

      fragment AdditionalFields on Greeting {
        sentAt
        recipient {
          name
        }
      }
    `;

    {
      const data = maskFragment(
        { message: "Hello world", __typename: "Greeting" },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        message: "Hello world",
        __typename: "Greeting",
      });
    }

    {
      const data = maskFragment(
        {
          __typename: "Greeting",
          message: "Hello world",
          sentAt: "2024-01-01",
        },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
      });
    }

    {
      const data = maskFragment(
        {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "__Person" },
        },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "__Person" },
      });
    }
  });

  // TODO: Remove .failing when refactoring migrate mode
  test.failing(
    'unmasks partial data with warnings with @unmask(mode: "migrate")',
    () => {
      using _ = spyOnConsole("warn");

      const fragment = gql`
        fragment GreetingFields on Greeting {
          message
          ...AdditionalFields @unmask(mode: "migrate")
        }

        fragment AdditionalFields on Greeting {
          sentAt
          recipient {
            name
          }
        }
      `;

      {
        const data = maskFragment(
          { message: "Hello world", __typename: "Greeting" },
          fragment,
          new InMemoryCache(),
          "GreetingFields"
        );

        expect(data).toEqual({
          greeting: { message: "Hello world", __typename: "Greeting" },
        });
      }

      {
        const data = maskFragment(
          {
            __typename: "Greeting",
            message: "Hello world",
            sentAt: "2024-01-01",
          },
          fragment,
          new InMemoryCache(),
          "GreetingFields"
        );

        data.__typename;
        data.message;

        expect(console.warn).not.toHaveBeenCalled();

        data.sentAt;
        expect(console.warn).toHaveBeenCalledTimes(1);

        expect(data).toEqual({
          __typename: "Greeting",
          message: "Hello world",
          sentAt: "2024-01-01",
        });
      }

      {
        const data = maskFragment(
          {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "__Person" },
          },
          fragment,
          new InMemoryCache(),
          "GreetingFields"
        );

        data.__typename;
        data.message;

        expect(console.warn).not.toHaveBeenCalled();

        data.recipient;
        data.recipient.__typename;
        expect(console.warn).toHaveBeenCalledTimes(1);

        expect(data).toEqual({
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "__Person" },
          },
        });
      }
    }
  );

  test("masks partial deferred data", () => {
    const fragment = gql`
      fragment GreetingFields on Greeting {
        message
        ... @defer {
          sentAt
          ...AdditionalFields
        }
      }

      fragment AdditionalFields on Greeting {
        recipient {
          name
        }
      }
    `;

    {
      const data = maskFragment(
        { message: "Hello world", __typename: "Greeting" },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        message: "Hello world",
        __typename: "Greeting",
      });
    }

    {
      const data = maskFragment(
        {
          __typename: "Greeting",
          message: "Hello world",
          sentAt: "2024-01-01",
          recipient: { __typename: "__Person", name: "Alice" },
        },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
      });
    }
  });

  test("unmasks partial deferred data with @unmask", () => {
    const fragment = gql`
      fragment GreetingFields on Greeting {
        message
        ... @defer {
          sentAt
          ...AdditionalFields @unmask
        }
      }

      fragment AdditionalFields on Greeting {
        recipient {
          name
        }
      }
    `;

    {
      const data = maskFragment(
        { message: "Hello world", __typename: "Greeting" },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        message: "Hello world",
        __typename: "Greeting",
      });
    }

    {
      const data = maskFragment(
        {
          __typename: "Greeting",
          message: "Hello world",
          sentAt: "2024-01-01",
          recipient: { __typename: "__Person", name: "Alice" },
        },
        fragment,
        new InMemoryCache(),
        "GreetingFields"
      );

      expect(data).toEqual({
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
        recipient: { __typename: "__Person", name: "Alice" },
      });
    }
  });

  // TODO: Remove .failing when refactoring migrate mode
  test.failing(
    'unmasks partial deferred data with warnings with @unmask(mode: "migrate")',
    () => {
      using _ = spyOnConsole("warn");

      const fragment = gql`
        fragment GreetingFields on Greeting {
          message
          ... @defer {
            sentAt
            ...AdditionalFields @unmask(mode: "migrate")
          }
        }

        fragment AdditionalFields on Greeting {
          recipient {
            name
          }
        }
      `;

      {
        const data = maskFragment(
          { message: "Hello world", __typename: "Greeting" },
          fragment,
          new InMemoryCache(),
          "GreetingFields"
        );

        expect(data).toEqual({
          greeting: { message: "Hello world", __typename: "Greeting" },
        });
      }

      {
        const data = maskFragment(
          {
            __typename: "Greeting",
            message: "Hello world",
            sentAt: "2024-01-01",
            recipient: { __typename: "__Person", name: "Alice" },
          },
          fragment,
          new InMemoryCache(),
          "GreetingFields"
        );

        data.message;
        data.sentAt;
        data.__typename;

        expect(console.warn).not.toHaveBeenCalled();

        data.recipient;
        data.recipient.__typename;
        data.recipient.name;
        expect(console.warn).toHaveBeenCalledTimes(3);

        expect(data).toEqual({
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            sentAt: "2024-01-01",
            recipient: { __typename: "__Person", name: "Alice" },
          },
        });
      }
    }
  );
});
