import { gql, InMemoryCache } from "../../core/index.js";
import { spyOnConsole } from "../../testing/internal/index.js";
import { deepFreeze } from "../../utilities/common/maybeDeepFreeze.js";
import { InvariantError } from "@apollo/client/utilities/invariant";
import { maskFragment } from "../maskFragment.js";

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

  const data = maskFragment(user, fragment, new InMemoryCache(), "UserFields");

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

  const data = maskFragment(user, fragment, new InMemoryCache(), "UserFields");

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

test("masks child fragments of @unmask", () => {
  using _ = spyOnConsole("warn");

  const fragment = gql`
    fragment UnmaskedUser on User {
      id
      name
      ...UserFields @unmask
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
      deepFreeze({ message: "Hello world", __typename: "Greeting" }),
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
      deepFreeze({
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
      }),
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
      deepFreeze({
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "__Person" },
      }),
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
      deepFreeze({ message: "Hello world", __typename: "Greeting" }),
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
      deepFreeze({
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
      }),
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
      deepFreeze({
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "__Person" },
      }),
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

test('unmasks partial data with warnings with @unmask(mode: "migrate")', () => {
  using consoleSpy = spyOnConsole("warn");

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
      deepFreeze({ message: "Hello world", __typename: "Greeting" }),
      fragment,
      new InMemoryCache(),
      "GreetingFields"
    );

    data.message;
    data.__typename;

    expect(console.warn).not.toHaveBeenCalled();

    expect(data).toEqual({
      message: "Hello world",
      __typename: "Greeting",
    });
  }

  consoleSpy.warn.mockClear();

  {
    const data = maskFragment(
      deepFreeze({
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
      }),
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

  consoleSpy.warn.mockClear();

  {
    const data = maskFragment(
      deepFreeze({
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "__Person" },
      }),
      fragment,
      new InMemoryCache(),
      "GreetingFields"
    );

    data.__typename;
    data.message;

    expect(console.warn).not.toHaveBeenCalled();

    data.recipient;
    // We do not warn on access to __typename
    data.recipient.__typename;
    expect(console.warn).toHaveBeenCalledTimes(1);

    expect(data).toEqual({
      __typename: "Greeting",
      message: "Hello world",
      recipient: { __typename: "__Person" },
    });
  }
});

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
      deepFreeze({ message: "Hello world", __typename: "Greeting" }),
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
      deepFreeze({
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
        recipient: { __typename: "__Person", name: "Alice" },
      }),
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
      deepFreeze({ message: "Hello world", __typename: "Greeting" }),
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
      deepFreeze({
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
        recipient: { __typename: "__Person", name: "Alice" },
      }),
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

test('unmasks partial deferred data with warnings with @unmask(mode: "migrate")', () => {
  using consoleSpy = spyOnConsole("warn");

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
      deepFreeze({ message: "Hello world", __typename: "Greeting" }),
      fragment,
      new InMemoryCache(),
      "GreetingFields"
    );

    expect(data).toEqual({
      message: "Hello world",
      __typename: "Greeting",
    });
  }

  consoleSpy.warn.mockClear();

  {
    const data = maskFragment(
      deepFreeze({
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
        recipient: { __typename: "__Person", name: "Alice" },
      }),
      fragment,
      new InMemoryCache(),
      "GreetingFields"
    );

    data.message;
    data.sentAt;
    data.__typename;

    expect(console.warn).not.toHaveBeenCalled();

    data.recipient;
    data.recipient.name;
    // We do not warn on access to __typename
    data.recipient.__typename;
    expect(console.warn).toHaveBeenCalledTimes(2);

    expect(data).toEqual({
      __typename: "Greeting",
      message: "Hello world",
      sentAt: "2024-01-01",
      recipient: { __typename: "__Person", name: "Alice" },
    });
  }
});

test("masks results with primitive arrays", () => {
  const fragment = gql`
    fragment ListingFragment on Listing {
      id
      reviews
      ...ListingFields
    }

    fragment ListingFields on Listing {
      amenities
    }
  `;

  const data = maskFragment(
    deepFreeze({
      __typename: "Listing",
      id: "1",
      reviews: [5, 5, 3, 4],
      amenities: ["pool", "hot tub", "backyard"],
    }),
    fragment,
    new InMemoryCache(),
    "ListingFragment"
  );

  expect(data).toEqual({
    __typename: "Listing",
    id: "1",
    reviews: [5, 5, 3, 4],
  });
});

test("unmasks results with primitive arrays with @unmask", () => {
  const fragment = gql`
    fragment ListingFragment on Listing {
      id
      reviews
      ...ListingFields @unmask
    }

    fragment ListingFields on Listing {
      amenities
    }
  `;

  const data = maskFragment(
    deepFreeze({
      __typename: "Listing",
      id: "1",
      reviews: [5, 5, 3, 4],
      amenities: ["pool", "hot tub", "backyard"],
    }),
    fragment,
    new InMemoryCache(),
    "ListingFragment"
  );

  expect(data).toEqual({
    __typename: "Listing",
    id: "1",
    reviews: [5, 5, 3, 4],
    amenities: ["pool", "hot tub", "backyard"],
  });
});

test('unmasks results with warnings with primitive arrays with @unmask(mode: "migrate")', () => {
  using _ = spyOnConsole("warn");

  const fragment = gql`
    fragment ListingFragment on Listing {
      id
      reviews
      ...ListingFields @unmask(mode: "migrate")
    }

    fragment ListingFields on Listing {
      amenities
    }
  `;

  const data = maskFragment(
    deepFreeze({
      __typename: "Listing",
      id: "1",
      reviews: [5, 5, 3, 4],
      amenities: ["pool", "hot tub", "backyard"],
    }),
    fragment,
    new InMemoryCache(),
    "ListingFragment"
  );

  data.__typename;
  data.id;
  data.reviews;

  expect(console.warn).not.toHaveBeenCalled();

  data.amenities;

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
    "fragment 'ListingFragment'",
    "amenities"
  );

  expect(data).toEqual({
    __typename: "Listing",
    id: "1",
    reviews: [5, 5, 3, 4],
    amenities: ["pool", "hot tub", "backyard"],
  });
});
