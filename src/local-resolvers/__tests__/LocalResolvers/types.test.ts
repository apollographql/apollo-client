import { LocalResolvers } from "@apollo/client/local-resolvers";

import type { RootValue } from "./fixtures/rootValue.js";

type SetRequired<T, Keys extends keyof T> = { [K in Keys]-?: T[K] } & Omit<
  T,
  Keys
>;

describe.skip("Type tests", () => {
  test("allows resolvers of anything with no generic", () => {
    interface Food {
      __typename: "Food";
      name: string;
    }
    new LocalResolvers();
    new LocalResolvers({ resolvers: {} });

    new LocalResolvers({
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

    new LocalResolvers({
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

    type RequiredRootResolver = SetRequired<Resolvers, "Query">;

    new LocalResolvers<Resolvers>();
    // @ts-expect-error missing argument
    new LocalResolvers<RequiredRootResolver>();

    new LocalResolvers<Resolvers>({});
    // @ts-expect-error missing resolvers option
    new LocalResolvers<RequiredRootResolver>({});

    new LocalResolvers<Resolvers>({
      resolvers: {},
    });
    new LocalResolvers<RequiredRootResolver>({
      // @ts-expect-error missing Query resolver
      resolvers: {},
    });

    new LocalResolvers<Resolvers>({
      rootValue: {
        env: "prod",
      },
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
    new LocalResolvers<RequiredRootResolver>({
      rootValue: {
        env: "prod",
      },
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

    new LocalResolvers<Resolvers>({
      resolvers: {
        Query: {},
      },
    });
    new LocalResolvers<RequiredRootResolver>({
      resolvers: {
        Query: {},
      },
    });

    new LocalResolvers<Resolvers>({
      resolvers: {
        Query: {
          // @ts-expect-error wrong return type
          currentUserId: () => {
            return true;
          },
        },
      },
    });
    new LocalResolvers<RequiredRootResolver>({
      resolvers: {
        Query: {
          // @ts-expect-error wrong return type
          currentUserId: () => {
            return true;
          },
        },
      },
    });

    new LocalResolvers<Resolvers>({
      resolvers: {
        User: {
          // @ts-expect-error missing __typename
          favoriteFood: () => ({ name: "Pizza" }),
        },
      },
    });
    new LocalResolvers<RequiredRootResolver>({
      resolvers: {
        User: {
          // @ts-expect-error missing __typename
          favoriteFood: () => ({ name: "Pizza" }),
        },
      },
    });

    new LocalResolvers<Resolvers>({
      resolvers: {
        Query: {
          currentUserId: () => "1",
        },
        User: {
          favoriteFood: () => ({ __typename: "Food" }),
        },
      },
    });
    new LocalResolvers<RequiredRootResolver>({
      resolvers: {
        Query: {
          currentUserId: () => "1",
        },
        User: {
          favoriteFood: () => ({ __typename: "Food" }),
        },
      },
    });

    new LocalResolvers<Resolvers>({
      resolvers: {
        // @ts-expect-error unknown typename
        Invalid: {},
      },
    });
    new LocalResolvers<RequiredRootResolver>({
      resolvers: {
        // @ts-expect-error unknown typename
        Invalid: {},
      },
    });

    new LocalResolvers<Resolvers>({
      resolvers: {
        Query: {
          // @ts-expect-error unknown field
          invalid: () => 1,
        },
      },
    });
    new LocalResolvers<RequiredRootResolver>({
      resolvers: {
        Query: {
          // @ts-expect-error unknown field
          invalid: () => 1,
        },
      },
    });
  });

  test("rootValue", () => {
    type Resolvers = import("./fixtures/local-resolvers.js").Resolvers;

    new LocalResolvers<Resolvers, RootValue>({
      rootValue: {
        env: "dev",
      },
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.env,
        },
      },
    });

    new LocalResolvers<Resolvers, RootValue>({
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

    new LocalResolvers<Resolvers, RootValue>({
      rootValue: () => ({
        env: "prod",
      }),
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.env,
        },
      },
    });

    new LocalResolvers<Resolvers, RootValue>({
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

    new LocalResolvers<Resolvers, RootValue>({
      rootValue: {
        env: "prod",
      },
      resolvers: {
        Query: {
          currentUserId: (rootValue: RootValue) => rootValue.env,
        },
      },
    });

    new LocalResolvers<Resolvers, RootValue>({
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

    new LocalResolvers<Resolvers>({
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

    new LocalResolvers({
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

    new LocalResolvers({
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

    // @ts-expect-error rootValue is not provided
    new LocalResolvers({
      resolvers: {
        Query: {
          currentUserId: (_rootValue: RootValue) => 1,
        },
      },
    });

    // @ts-expect-error argument required
    new LocalResolvers<
      { User?: { isLoggedIn: LocalResolvers.Resolver } },
      RootValue
    >();

    new LocalResolvers<
      { User?: { isLoggedIn: LocalResolvers.Resolver } },
      RootValue
    >(
      // @ts-expect-error rootValue is required
      {}
    );

    new LocalResolvers<
      { User?: { isLoggedIn: LocalResolvers.Resolver } },
      RootValue
    >(
      // @ts-expect-error rootValue is required
      {
        resolvers: {},
      }
    );
  });
});
