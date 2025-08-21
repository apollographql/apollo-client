import { expectTypeOf } from "expect-type";

import { LocalState } from "@apollo/client/local-state";

import type { ContextValue } from "./fixtures/context-value.js";

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
      // note: the default type of context is `DefaultContext` which is defined
      // as `DefaultContext extends Record<string, any>` so this type test
      // demonstrates that we can return keys that aren't explicit in the
      // `DefaultContext` type.
      context: () => ({
        env: "development",
      }),
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
      import("./fixtures/local-resolvers-without-context-value.js").Resolvers;
    type Food =
      import("./fixtures/local-resolvers-without-context-value.js").Food;
    const { FoodCategory } = await import(
      "./fixtures/local-resolvers-without-context-value.js"
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
            expectTypeOf(food).toEqualTypeOf<Food>();
            expectTypeOf(limit).toEqualTypeOf<number | null | undefined>();
            expectTypeOf(offset).toEqualTypeOf<number>();

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
            expectTypeOf(food).toEqualTypeOf<Food>();
            expectTypeOf(limit).toEqualTypeOf<number | null | undefined>();
            expectTypeOf(offset).toEqualTypeOf<number>();

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

  test("context", () => {
    type Resolvers = import("./fixtures/local-resolvers.js").Resolvers;

    // @ts-expect-error missing required context value
    new LocalState<Resolvers, ContextValue>({
      resolvers: {},
    });

    new LocalState<Resolvers, ContextValue>({
      context: () => ({ env: "dev" }),
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.currentUser?.id ?? null,
        },
      },
    });

    new LocalState<Resolvers, ContextValue>({
      context: ({ requestContext }) => ({ ...requestContext, env: "dev" }),
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.currentUser?.id ?? null,
        },
      },
    });

    new LocalState<Resolvers, ContextValue>({
      context: ({ requestContext }) => ({
        ...requestContext,
        // @ts-expect-error invalid value
        env: "staging",
      }),
      resolvers: {
        Query: {
          currentUserId: (_, __, { requestContext }) => requestContext.env,
        },
      },
    });

    new LocalState<Resolvers, ContextValue>({
      context: () => ({
        env: "prod",
      }),
      resolvers: {
        Query: {
          // @ts-expect-error requestContext is incorrect type
          currentUserId: (
            _,
            __,
            { requestContext }: { requestContext: { invalid: boolean } }
          ) => "1",
        },
      },
    });

    new LocalState<Resolvers>({
      context: () => ({
        // @ts-expect-error invalid value for env
        env: "staging",
      }),
      resolvers: {
        Query: {
          currentUserId: (rootValue) => rootValue.currentUser?.id ?? null,
        },
      },
    });

    new LocalState({
      context: () => ({
        // @ts-expect-error invalid value for env
        env: "staging",
      }),
      resolvers: {
        Query: {
          currentUserId: (
            _,
            __,
            { requestContext }: { requestContext: ContextValue }
          ) => 1,
        },
      },
    });
  });
});
