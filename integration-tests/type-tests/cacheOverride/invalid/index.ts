import {
  ApolloCache,
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  MutationUpdaterFunction,
  TypedDocumentNode,
} from "@apollo/client";
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
  useQuery,
  useSuspenseQuery,
} from "@apollo/client/react";
import { expectTypeOf } from "expect-type";
import { test, TestCache } from "../shared/index.js";

// A cache type that doesn't extend ApolloCache should behave like ApolloCache
declare module "@apollo/client" {
  export interface TypeOverrides {
    cache: number;
  }
}
type Data = { foo: string };
type Variables = { bar?: string };

declare const mutation: TypedDocumentNode<Data, Variables>;
declare const query: TypedDocumentNode<Data, Variables>;

test("ApolloClient constructor", () => {
  {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
  }

  {
    const client = new ApolloClient({
      cache: new TestCache(),
      link: ApolloLink.empty(),
    });

    expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
  }

  {
    const client = new ApolloClient({
      // @ts-expect-error not an ApolloCache subtype despite the type override
      cache: 123,
      link: ApolloLink.empty(),
    });

    expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
  }
});

test("client.mutate", () => {
  const client = new ApolloClient({
    cache: new TestCache(),
    link: ApolloLink.empty(),
  });

  client.mutate({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
    },
  });

  client.mutate<Data, Variables>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
    },
  });

  client.mutate<Data, Variables, TestCache>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<TestCache>();
    },
  });

  client.mutate<Data, Variables, InMemoryCache>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<InMemoryCache>();
    },
  });
});

test("client.refetchQueries", () => {
  {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    client.refetchQueries({
      updateCache: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
      },
    });
  }

  {
    const client = new ApolloClient({
      cache: new TestCache(),
      link: ApolloLink.empty(),
    });

    client.refetchQueries({
      updateCache: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
      },
    });
  }
});

test("cache.batch", () => {
  const client = new ApolloClient({
    cache: new TestCache(),
    link: ApolloLink.empty(),
  });

  client.cache.batch({
    update(cache) {
      expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
    },
    onWatchUpdated() {
      expectTypeOf(this).toEqualTypeOf<ApolloCache>();
    },
  });
});

test("useApolloClient", () => {
  const client = useApolloClient();

  expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
});

test("useLazyQuery", () => {
  const [, { client }] = useLazyQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
});

test("useMutation", () => {
  {
    const [mutate, { client }] = useMutation(mutation, {
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, ApolloCache>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, ApolloCache>
        >;
      },
    });

    mutate({
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, ApolloCache>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, ApolloCache>
        >;
      },
    });

    expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
  }

  {
    const [mutate, { client }] = useMutation<Data, Variables>(mutation, {
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, ApolloCache>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, ApolloCache>
        >;
      },
    });

    mutate({
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, ApolloCache>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, ApolloCache>
        >;
      },
    });

    expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
  }

  // Ensure TCache can override any subtype of ApolloCache
  {
    const [mutate, { client }] = useMutation<Data, Variables, TestCache>(
      mutation,
      {
        update: (cache) => {
          expectTypeOf(cache).toEqualTypeOf<TestCache>();
        },
        onCompleted: (_, options) => {
          expectTypeOf(options!.update!).toEqualTypeOf<
            MutationUpdaterFunction<Data, Variables, TestCache>
          >;
        },
        onError: (_, options) => {
          expectTypeOf(options!.update!).toEqualTypeOf<
            MutationUpdaterFunction<Data, Variables, TestCache>
          >;
        },
      }
    );

    mutate({
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<TestCache>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, TestCache>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, TestCache>
        >;
      },
    });

    expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
  }

  // Ensure TCache can override any subtype of ApolloCache
  {
    const [mutate, { client }] = useMutation<Data, Variables, InMemoryCache>(
      mutation,
      {
        update: (cache) => {
          expectTypeOf(cache).toEqualTypeOf<InMemoryCache>();
        },
        onCompleted: (_, options) => {
          expectTypeOf(options!.update!).toEqualTypeOf<
            MutationUpdaterFunction<Data, Variables, InMemoryCache>
          >;
        },
        onError: (_, options) => {
          expectTypeOf(options!.update!).toEqualTypeOf<
            MutationUpdaterFunction<Data, Variables, InMemoryCache>
          >;
        },
      }
    );

    mutate({
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<InMemoryCache>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, InMemoryCache>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, InMemoryCache>
        >;
      },
    });

    expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
  }
});

test("useQuery", () => {
  const { client } = useQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
});

test("useSuspenseQuery", () => {
  const { client } = useSuspenseQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
});
