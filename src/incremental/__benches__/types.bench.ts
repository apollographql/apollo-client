import { attest, bench, setup } from "@ark/attest";
import { expectTypeOf } from "expect-type";

import type { GraphQLCodegenIncremental } from "@apollo/client/incremental";
import type { DeepPartial } from "@apollo/client/utilities";

setup({
  updateSnapshots: !process.env.CI,
});

function test(name: string, fn: (name: string) => void) {
  fn(name + ": ");
}

type UnrelatedStreaming = { __typename: "Unrelated"; id: string } & (
  | { __typename: "Unrelated"; extra: boolean }
  | { __typename: "Unrelated"; extra?: never }
);
// @ts-ignore
type _TypeCacheWarmup =
  | GraphQLCodegenIncremental.Complete<UnrelatedStreaming>
  | GraphQLCodegenIncremental.Partial<UnrelatedStreaming>;

test("assembles inline single-field @defer", (prefix) => {
  // query {
  //   user {
  //     id
  //     ... @defer {
  //       name
  //     }
  //   }
  // }
  type Source = {
    user:
      | ({ __typename: "User"; id: string } & (
          | { __typename: "User"; name: string }
          | { __typename: "User"; name?: never }
        ))
      | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      user: { __typename: "User"; id: string; name: string } | null;
    }>();
  });
});

test("assembles named fragment @defer", (prefix) => {
  // query {
  //   user {
  //     id
  //     ...UserDetails @defer
  //   }
  // }
  // fragment UserDetails on User {
  //   name
  //   age
  // }
  type Source = {
    user:
      | ({ __typename: "User"; id: string } & (
          | { __typename: "User"; name: string; age: number }
          | { __typename: "User"; name?: never; age?: never }
        ))
      | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      user: {
        __typename: "User";
        id: string;
        name: string;
        age: number;
      } | null;
    }>();
  });
});

test("assembles inline multi-field @defer split per field", (prefix) => {
  // query {
  //   user {
  //     id
  //     ... @defer {
  //       name
  //       age
  //       description
  //     }
  //   }
  // }
  //
  // Note: Codegen emits independent present|never unions per field with inline
  // @defer, not a single union for the fragment.
  type Source = {
    user:
      | ({ __typename: "User"; id: string } & (
          | { __typename: "User"; name: string }
          | { __typename: "User"; name?: never }
        ) &
          (
            | { __typename: "User"; age: number }
            | { __typename: "User"; age?: never }
          ) &
          (
            | { __typename: "User"; description: string | null }
            | { __typename: "User"; description?: never }
          ))
      | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      user: {
        __typename: "User";
        id: string;
        name: string;
        age: number;
        description: string | null;
      } | null;
    }>();
  });
});

test("assembles multiple independent @defer fragments", (prefix) => {
  // query {
  //   user {
  //     id
  //     ... @defer {
  //       name
  //     }
  //     ... @defer {
  //       description
  //     }
  //     ... @defer {
  //       profile {
  //         bio
  //       }
  //     }
  //   }
  // }
  type Source = {
    user:
      | ({ __typename: "User"; id: string } & (
          | { __typename: "User"; name: string }
          | { __typename: "User"; name?: never }
        ) &
          (
            | { __typename: "User"; description: string | null }
            | { __typename: "User"; description?: never }
          ) &
          (
            | {
                __typename: "User";
                profile: { __typename: "Profile"; bio: string };
              }
            | { __typename: "User"; profile?: never }
          ))
      | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      user: {
        __typename: "User";
        id: string;
        name: string;
        description: string | null;
        profile: { __typename: "Profile"; bio: string };
      } | null;
    }>();
  });
});

test("assembles @defer nested inside arrays", (prefix) => {
  // query {
  //   user {
  //     id
  //     friends {
  //       id
  //       ... @defer {
  //         name
  //       }
  //     }
  //   }
  // }
  type Source = {
    user: {
      __typename: "User";
      id: string;
      friends: Array<
        { __typename: "Friend"; id: string } & (
          | { __typename: "Friend"; name: string }
          | { __typename: "Friend"; name?: never }
        )
      >;
    } | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      user: {
        __typename: "User";
        id: string;
        friends: Array<{ __typename: "Friend"; id: string; name: string }>;
      } | null;
    }>();
  });
});

test("assembles @defer nested inside nullable and optional arrays", (prefix) => {
  // query {
  //   user {
  //     friends {
  //       id
  //       ... @defer {
  //         name
  //       }
  //     }
  //     blockedFriends @include(if: $withBlocked) {
  //       id
  //       ... @defer {
  //         name
  //       }
  //     }
  //   }
  // }
  type Source = {
    user: {
      __typename: "User";
      friends: Array<
        { __typename: "Friend"; id: string } & (
          | { __typename: "Friend"; name: string }
          | { __typename: "Friend"; name?: never }
        )
      > | null;
      blockedFriends?: Array<
        { __typename: "Friend"; id: string } & (
          | { __typename: "Friend"; name: string }
          | { __typename: "Friend"; name?: never }
        )
      > | null;
    } | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      user: {
        __typename: "User";
        friends: Array<{
          __typename: "Friend";
          id: string;
          name: string;
        }> | null;
        blockedFriends?: Array<{
          __typename: "Friend";
          id: string;
          name: string;
        }> | null;
      } | null;
    }>();
  });
});

test("assembles @defer inside ReadonlyArray", (prefix) => {
  // query {
  //   friends {
  //     id
  //     ... @defer {
  //       name
  //     }
  //   }
  // }
  type Source = {
    friends: ReadonlyArray<
      { __typename: "Friend"; id: string } & (
        | { __typename: "Friend"; name: string }
        | { __typename: "Friend"; name?: never }
      )
    >;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      friends: ReadonlyArray<{
        __typename: "Friend";
        id: string;
        name: string;
      }>;
    }>();
  });
});

test("leaves @skip/@include optionals in place", (prefix) => {
  // query {
  //   user {
  //     id
  //     name @include(if: $withName)
  //   }
  // }
  type Source = {
    user: { __typename: "User"; id: string; name?: string | null } | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<
      GraphQLCodegenIncremental.Complete<Source>
    >().toEqualTypeOf<Source>();
  });
});

test("does not treat GraphQL interface/union result unions as incremental", (prefix) => {
  // query {
  //   search {
  //     ... on User {
  //       id
  //       name
  //     }
  //     ... on Post {
  //       id
  //       title
  //     }
  //   }
  // }
  type Source = {
    search: Array<
      | { __typename: "User"; id: string; name: string }
      | { __typename: "Post"; id: string; title: string }
    >;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<
      GraphQLCodegenIncremental.Complete<Source>
    >().toEqualTypeOf<Source>();
  });
});

test("assembles @defer on one member of a GraphQL union", (prefix) => {
  // query {
  //   search {
  //     ... on User {
  //       id
  //       ... @defer {
  //         name
  //       }
  //     }
  //     ... on Post {
  //       id
  //       title
  //     }
  //   }
  // }
  type Source = {
    search: Array<
      | ({ __typename: "User"; id: string } & (
          | { __typename: "User"; name: string }
          | { __typename: "User"; name?: never }
        ))
      | { __typename: "Post"; id: string; title: string }
    >;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      search: Array<
        | { __typename: "User"; id: string; name: string }
        | { __typename: "Post"; id: string; title: string }
      >;
    }>();
  });
});

test("collapses Incremental<T> on masked deferred fragment refs", (prefix) => {
  // query {
  //   user {
  //     id
  //     ...UserDetails @defer
  //   }
  // }
  // fragment UserDetails on User {
  //   name
  //   age
  // }
  //
  // Note: with inlineFragmentTypes: "mask", codegen wraps the deferred fragment
  // as Incremental<T>.
  type Incremental<T> =
    | T
    | {
        [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P]
        : never;
      };

  type UserDetailsFragment = {
    __typename: "User";
    name: string;
    age: number;
    " $fragmentName"?: "UserDetailsFragment";
  };

  type Source = {
    user:
      | ({ __typename: "User"; id: string } & {
          " $fragmentRefs"?: {
            UserDetailsFragment: Incremental<UserDetailsFragment>;
          };
        })
      | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      user: {
        __typename: "User";
        id: string;
        " $fragmentRefs"?: {
          UserDetailsFragment: UserDetailsFragment;
        };
      } | null;
    }>();
  });
});

test("assembles deeply nested mixed @defer", (prefix) => {
  // query {
  //   user {
  //     id
  //     ... @defer {
  //       name
  //     }
  //     friends {
  //       id
  //       ... @defer {
  //         name
  //       }
  //       profile {
  //         ... @defer {
  //           bio
  //           avatar
  //         }
  //       }
  //     }
  //   }
  // }
  type Source = {
    user:
      | ({
          __typename: "User";
          id: string;
          friends: Array<
            { __typename: "Friend"; id: string } & (
              | { __typename: "Friend"; name: string }
              | { __typename: "Friend"; name?: never }
            ) & {
                profile:
                  | ({ __typename: "Profile" } & (
                      | { __typename: "Profile"; bio: string }
                      | { __typename: "Profile"; bio?: never }
                    ) &
                      (
                        | { __typename: "Profile"; avatar: string }
                        | { __typename: "Profile"; avatar?: never }
                      ))
                  | null;
              }
          >;
        } & (
          | { __typename: "User"; name: string }
          | { __typename: "User"; name?: never }
        ))
      | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
      user: {
        __typename: "User";
        id: string;
        name: string;
        friends: Array<{
          __typename: "Friend";
          id: string;
          name: string;
          profile: {
            __typename: "Profile";
            bio: string;
            avatar: string;
          } | null;
        }>;
      } | null;
    }>();
  });
});

test("is an identity for operations without @defer", (prefix) => {
  // query {
  //   user {
  //     id
  //     name
  //   }
  // }
  type Source = {
    user: { __typename: "User"; id: string; name: string } | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Complete<Source>;
  }).types([6, "instantiations"]);

  bench(prefix + "functionality", () => {
    type NoDefer = { __typename: "User"; id: string; name: string };

    expectTypeOf<
      GraphQLCodegenIncremental.Complete<Source>
    >().toEqualTypeOf<Source>();
    expectTypeOf<
      GraphQLCodegenIncremental.Complete<NoDefer | null>
    >().toEqualTypeOf<NoDefer | null>();
    expectTypeOf<
      GraphQLCodegenIncremental.Complete<NoDefer | undefined>
    >().toEqualTypeOf<NoDefer | undefined>();
    expectTypeOf<
      GraphQLCodegenIncremental.Complete<NoDefer | null | undefined>
    >().toEqualTypeOf<NoDefer | null | undefined>();
  });
});

test("Complete handles odd types", (prefix) => {
  {
    type Source = {};

    bench(prefix + "empty type instantiations", () => {
      return {} as GraphQLCodegenIncremental.Complete<Source>;
    }).types([6, "instantiations"]);

    bench(prefix + "empty type functionality", () => {
      expectTypeOf<
        GraphQLCodegenIncremental.Complete<Source>
      >().toEqualTypeOf<{}>();
    });
  }

  {
    type Source = Record<string, any>;

    bench(prefix + "generic record type instantiations", () => {
      return {} as GraphQLCodegenIncremental.Complete<Source>;
    }).types([6, "instantiations"]);

    bench(prefix + "generic record type functionality", () => {
      expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<
        Record<string, any>
      >();
    });
  }

  {
    type Source = unknown;

    bench(prefix + "unknown instantiations", () => {
      return {} as GraphQLCodegenIncremental.Complete<Source>;
    }).types([6, "instantiations"]);

    bench(prefix + "unknown functionality", () => {
      expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toBeUnknown();
    });
  }

  {
    type Source = any;

    bench(prefix + "any instantiations", () => {
      return {} as GraphQLCodegenIncremental.Complete<Source>;
    }).types([6, "instantiations"]);

    bench(prefix + "any functionality", () => {
      expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toBeAny();
    });
  }

  {
    type Source = {
      coords: [long: number, lat: number];
    };

    bench(prefix + "tuple instantiations", () => {
      return {} as GraphQLCodegenIncremental.Complete<Source>;
    }).types([6, "instantiations"]);

    bench(prefix + "tuple functionality", () => {
      expectTypeOf<GraphQLCodegenIncremental.Complete<Source>>().toEqualTypeOf<{
        coords: [long: number, lat: number];
      }>();
    });
  }
});

test("Partial is DeepPartial of the assembled complete type", (prefix) => {
  // query {
  //   user {
  //     id
  //     ... @defer {
  //       name
  //     }
  //   }
  // }
  type Source = {
    user:
      | ({ __typename: "User"; id: string } & (
          | { __typename: "User"; name: string }
          | { __typename: "User"; name?: never }
        ))
      | null;
  };

  type ExpectedComplete = {
    user: { __typename: "User"; id: string; name: string } | null;
  };

  bench(prefix + "instantiations", () => {
    return {} as GraphQLCodegenIncremental.Partial<Source>;
  }).types([9, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<GraphQLCodegenIncremental.Partial<Source>>().toEqualTypeOf<
      DeepPartial<ExpectedComplete>
    >();
  });
});

test("distributed members on Complete", (prefix) => {
  // Not a specific operation. Complete<T | U> must distribute to Complete<T> | Complete<U>
  // so hook result unions like TData | null stay intact.
  (function unresolvedGeneric<T>() {
    bench(
      prefix +
        "one unresolved generic mixed with null|undefined instantiations",
      () => {
        return {} as GraphQLCodegenIncremental.Complete<T | null | undefined>;
      }
    ).types([2, "instantiations"]);

    bench(
      prefix + "one unresolved generic mixed with null|undefined functionality",
      () => {
        attest<
          [GraphQLCodegenIncremental.Complete<T | null | undefined>],
          [GraphQLCodegenIncremental.Complete<T> | null | undefined]
        >();
      }
    );
  })();

  (function unresolvedGenerics<T, V>() {
    bench(
      prefix +
        "two unresolved generics distribute instantiations instantiations",
      () => {
        return {} as GraphQLCodegenIncremental.Complete<T | V>;
      }
    ).types([2, "instantiations"]);

    bench(
      prefix +
        "two unresolved generics distribute instantiations functionality",
      () => {
        attest<
          [GraphQLCodegenIncremental.Complete<T | V>],
          [
            | GraphQLCodegenIncremental.Complete<T>
            | GraphQLCodegenIncremental.Complete<V>,
          ]
        >();
      }
    );
  })();
});
