import { mask } from "../masking.js";
import { gql } from "../index.js";

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

  const { data } = mask({ foo: true, bar: true }, query);

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

  const { data } = mask(
    { user: { __typename: "User", id: 1, name: "Test User" } },
    query
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

  const { data } = mask(
    {
      users: [
        { __typename: "User", id: 1, name: "Test User 1" },
        { __typename: "User", id: 2, name: "Test User 2" },
      ],
    },
    query
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

  const { data } = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        age: 30,
        avatarUrl: "https://example.com/avatar.jpg",
      },
    },
    query
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

  const { data } = mask(
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
    query
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

  const { data } = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        birthdate: "1990-01-01",
        name: "Test User",
      },
    },
    query
  );

  expect(data).toEqual({
    user: { __typename: "User", id: 1, birthdate: "1990-01-01" },
  });
});

test("does not strip inline fragments", () => {
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

  const { data } = mask(
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
    query
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

  const { data } = mask(
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
    query
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

test("handles overlapping fields inside multiple inline fragments", () => {
  const query = gql`
    query {
      drinks {
        __typename
        id
        ... @defer {
          amount
        }
        ... on Latte {
          milkType
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
  `;

  const { data } = mask(
    {
      drinks: [
        { __typename: "Latte", id: 1, amount: 12, shots: 2, milkType: "Cow" },
        { __typename: "Juice", id: 2, amount: 10, fruitBase: "Apple" },
        {
          __typename: "HotChocolate",
          id: 3,
          amount: 8,
          milkType: "Cow",
          chocolateType: "dark",
        },
      ],
    },
    query
  );

  expect(data).toEqual({
    drinks: [
      { __typename: "Latte", id: 1, amount: 12, shots: 2, milkType: "Cow" },
      { __typename: "Juice", id: 2, amount: 10 },
      {
        __typename: "HotChocolate",
        id: 3,
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

  const { data } = mask(
    { user: { __typename: "User", id: 1, name: "Test User" } },
    query
  );

  expect(data).toEqual({
    user: { __typename: "User", id: 1, name: "Test User" },
  });
});

test.skip("maintains referential equality on subtrees that did not change", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        profile {
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
  const originalData = { user, post, authors, industries };

  const { data } = mask(originalData, query);

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
});

test.skip("maintains referential equality the entire result if there are no fragments", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        name
      }
    }
  `;

  const originalData = {
    user: {
      __typename: "User",
      id: 1,
      name: "Test User",
    },
  };

  const { data } = mask(originalData, query);

  expect(data).toBe(originalData);
});
