import { LocalResolversLink } from "@apollo/client/link/local-resolvers";

export interface RootValue {
  env: "dev" | "prod";
}

describe.skip("Type tests", () => {
  test("allows resolvers of anything with no generic", () => {
    interface Food {
      __typename: "Food";
      name: string;
    }
    new LocalResolversLink();

    new LocalResolversLink({
      resolvers: {
        Query: {
          currentUserId: () => "1",
        },
        User: {
          favoriteFood: () => ({ __typename: "Food" }),
        },
        Food: {
          name: (parent: Food) => parent.name,
          ingredients: () => {},
        },
      },
    });

    new LocalResolversLink({
      rootValue: {
        env: "development",
      },
      resolvers: {
        Query: {
          currentUserId: () => "1",
        },
        User: {
          favoriteFood: () => ({ __typename: "Food" }),
        },
        Food: {
          name: (parent: Food) => parent.name,
          ingredients: () => {},
        },
      },
    });
  });

  test("works with codegen resolver types", async () => {
    type Resolvers = import("./fixtures/local-resolvers.js").Resolvers;
    const { FoodCategory } = await import("./fixtures/local-resolvers.js");

    // @ts-expect-error missing argument
    new LocalResolversLink<Resolvers>();
    // @ts-expect-error missing resolvers option
    new LocalResolversLink<Resolvers>({});

    new LocalResolversLink<Resolvers>({
      // @ts-expect-error missing Query resolver
      resolvers: {},
    });

    new LocalResolversLink<Resolvers>({
      resolvers: {
        Query: {
          currentUserId: () => "1",
        },
        User: {
          favoriteFood: () => ({
            __typename: "Food",
            name: "Pasta",
            categories: [FoodCategory.Italian],
          }),
        },
        Food: {
          name: (food) => food.name?.toUpperCase() ?? null,
          categories: (food, { limit, offset }) => {
            limit = limit ?? 5;
            return food.categories?.slice(offset, offset + limit) ?? [];
          },
        },
      },
    });

    new LocalResolversLink<Resolvers>({
      resolvers: {
        // @ts-expect-error missing currentUserId resolver
        Query: {},
      },
    });

    new LocalResolversLink<Resolvers>({
      resolvers: {
        Query: {
          // @ts-expect-error wrong return type
          currentUserId: () => {
            return true;
          },
        },
      },
    });

    new LocalResolversLink<Resolvers>({
      resolvers: {
        User: {
          // @ts-expect-error missing __typename
          favoriteFood: () => ({ name: "Pizza" }),
        },
      },
    });

    new LocalResolversLink<Resolvers>({
      resolvers: {
        Query: {
          currentUserId: () => "1",
        },
        User: {
          // @ts-expect-error missing name field
          favoriteFood: () => ({ __typename: "Food" }),
        },
      },
    });

    new LocalResolversLink<Resolvers>({
      resolvers: {
        // @ts-expect-error unknown typename
        Invalid: {},
      },
    });

    new LocalResolversLink<Resolvers>({
      resolvers: {
        Query: {
          // @ts-expect-error unknown field
          invalid: () => 1,
        },
      },
    });
  });

  test("filters out scalar resolvers", () => {
    type Resolvers =
      import("./fixtures/local-resolvers-with-scalar.js").Resolvers;

    new LocalResolversLink<Resolvers>({
      resolvers: {
        // @ts-expect-error unknown type
        Date: {
          field: () => {},
        },
      },
    });

    new LocalResolversLink<Resolvers>({
      resolvers: {
        User: {
          // ok: type is unknown
          lastLoggedInAt: () => {},
        },
      },
    });
  });

  test("rootValue", () => {
    type Resolvers = import("./fixtures/local-resolvers.js").Resolvers;

    new LocalResolversLink<Resolvers, RootValue>({
      rootValue: {
        env: "dev",
      },
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.env,
        },
      },
    });

    new LocalResolversLink<Resolvers, RootValue>({
      rootValue: {
        // @ts-expect-error invalid value
        env: "staging",
      },
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.env,
        },
      },
    });

    new LocalResolversLink<Resolvers, RootValue>({
      rootValue: () => ({
        env: "prod",
      }),
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.env,
        },
      },
    });

    new LocalResolversLink<Resolvers, RootValue>({
      // @ts-expect-error incorrect value
      rootValue: () => ({
        env: "staging",
      }),
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.env,
        },
      },
    });

    new LocalResolversLink<Resolvers, RootValue>({
      rootValue: {
        env: "prod",
      },
      resolvers: {
        Query: {
          currentUserId: (rootValue: RootValue) => rootValue.env,
        },
      },
    });

    new LocalResolversLink<Resolvers, RootValue>({
      rootValue: {
        env: "prod",
      },
      resolvers: {
        Query: {
          // @ts-expect-error parent is incorrect type
          currentUserId: (rootValue: { invalid: boolean }) => "1",
        },
      },
    });

    new LocalResolversLink<Resolvers>({
      rootValue: {
        // @ts-expect-error invalid value for env
        env: "staging",
      },
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.env,
        },
      },
    });

    new LocalResolversLink({
      rootValue: {
        // @ts-expect-error invalid value for env
        env: "staging",
      },
      resolvers: {
        Query: {
          currentUserId: (_rootValue: RootValue) => 1,
        },
      },
    });

    new LocalResolversLink({
      // @ts-expect-error invalid value for env
      rootValue: () => ({
        env: "staging",
      }),
      resolvers: {
        Query: {
          currentUserId: (_rootValue: RootValue) => 1,
        },
      },
    });
  });
});
