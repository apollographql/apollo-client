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

  test("works with codegen resolver types", () => {
    type Resolvers = import("./fixtures/local-resolvers.js").Resolvers;

    new LocalResolversLink<Resolvers>();

    new LocalResolversLink<Resolvers>({
      resolvers: {},
    });

    new LocalResolversLink<Resolvers>({
      resolvers: {
        Query: {
          currentUserId: () => "1",
        },
        User: {
          favoriteFood: () => ({ __typename: "Food", name: "Pizza" }),
        },
        Food: {
          name: (food) => food.name?.toUpperCase() ?? null,
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
    });

    new LocalResolversLink<Resolvers, RootValue>({
      rootValue: {
        // @ts-expect-error invalid value
        env: "staging",
      },
    });

    new LocalResolversLink<Resolvers, RootValue>({
      rootValue: () => ({
        env: "prod",
      }),
    });

    new LocalResolversLink<Resolvers, RootValue>({
      // @ts-expect-error incorrect value
      rootValue: () => ({
        env: "staging",
      }),
    });

    new LocalResolversLink<Resolvers, RootValue>({
      rootValue: {
        env: "prod",
      },
      resolvers: {
        Query: {
          currentUserId: (parent: RootValue) => "1",
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
          currentUserId: (parent: { invalid: boolean }) => "1",
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
          currentUserId: (_rootValue) => "1",
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
