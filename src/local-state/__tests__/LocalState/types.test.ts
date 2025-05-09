import { LocalState } from "@apollo/client/local-state";

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
    new LocalState();
    new LocalState({ resolvers: {} });

    new LocalState({
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

    new LocalState({
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
    type Resolvers =
      import("./fixtures/local-resolvers-without-root.js").Resolvers;
    const { FoodCategory } = await import(
      "./fixtures/local-resolvers-without-root.js"
    );

    type RequiredRootResolver = SetRequired<Resolvers, "Query">;

    new LocalState<Resolvers>();
    // @ts-expect-error missing argument
    new LocalState<RequiredRootResolver>();

    new LocalState<Resolvers>({});
    // @ts-expect-error missing resolvers option
    new LocalState<RequiredRootResolver>({});

    new LocalState<Resolvers>({
      resolvers: {},
    });
    new LocalState<RequiredRootResolver>({
      // @ts-expect-error missing Query resolver
      resolvers: {},
    });

    new LocalState<Resolvers>({
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
    new LocalState<RequiredRootResolver>({
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

    new LocalState<Resolvers>({
      resolvers: {
        Query: {},
      },
    });
    new LocalState<RequiredRootResolver>({
      resolvers: {
        Query: {},
      },
    });

    new LocalState<Resolvers>({
      resolvers: {
        Query: {
          // @ts-expect-error wrong return type
          currentUserId: () => {
            return true;
          },
        },
      },
    });
    new LocalState<RequiredRootResolver>({
      resolvers: {
        Query: {
          // @ts-expect-error wrong return type
          currentUserId: () => {
            return true;
          },
        },
      },
    });

    new LocalState<Resolvers>({
      resolvers: {
        User: {
          // @ts-expect-error missing __typename
          favoriteFood: () => ({ name: "Pizza" }),
        },
      },
    });
    new LocalState<RequiredRootResolver>({
      resolvers: {
        User: {
          // @ts-expect-error missing __typename
          favoriteFood: () => ({ name: "Pizza" }),
        },
      },
    });

    new LocalState<Resolvers>({
      resolvers: {
        Query: {
          currentUserId: () => "1",
        },
        User: {
          favoriteFood: () => ({ __typename: "Food" }),
        },
      },
    });
    new LocalState<RequiredRootResolver>({
      resolvers: {
        Query: {
          currentUserId: () => "1",
        },
        User: {
          favoriteFood: () => ({ __typename: "Food" }),
        },
      },
    });

    new LocalState<Resolvers>({
      resolvers: {
        // @ts-expect-error unknown typename
        Invalid: {},
      },
    });
    new LocalState<RequiredRootResolver>({
      resolvers: {
        // @ts-expect-error unknown typename
        Invalid: {},
      },
    });

    new LocalState<Resolvers>({
      resolvers: {
        Query: {
          // @ts-expect-error unknown field
          invalid: () => 1,
        },
      },
    });
    new LocalState<RequiredRootResolver>({
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

    new LocalState<Resolvers, RootValue>({
      rootValue: {
        env: "dev",
      },
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.env,
        },
      },
    });

    new LocalState<Resolvers, RootValue>({
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

    new LocalState<Resolvers, RootValue>({
      rootValue: () => ({
        env: "prod",
      }),
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.env,
        },
      },
    });

    new LocalState<Resolvers, RootValue>({
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

    new LocalState<Resolvers, RootValue>({
      rootValue: {
        env: "prod",
      },
      resolvers: {
        Query: {
          currentUserId: (rootValue: RootValue) => rootValue.env,
        },
      },
    });

    new LocalState<Resolvers, RootValue>({
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

    new LocalState<Resolvers>({
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

    new LocalState({
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

    new LocalState({
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
    new LocalState({
      resolvers: {
        Query: {
          currentUserId: (_rootValue: RootValue) => 1,
        },
      },
    });

    new LocalState<{ User?: { isLoggedIn: LocalState.Resolver } }, RootValue>(
      // @ts-expect-error rootValue is required
      {}
    );

    new LocalState<{ User?: { isLoggedIn: LocalState.Resolver } }, RootValue>(
      // @ts-expect-error rootValue is required
      {
        resolvers: {},
      }
    );
  });
});
