import {
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

    expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
  }

  {
    const client = new ApolloClient({
      // @ts-expect-error Using a cache other than `InMemoryCache` requires a cache type declared in TypeOverrides. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.      cache: new TestCache(),
      cache: new TestCache(),
      link: ApolloLink.empty(),
    });

    expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
  }
});

test("client.mutate", () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.mutate({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<InMemoryCache>();
    },
  });

  client.mutate<Data, Variables>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<InMemoryCache>();
    },
  });

  // @ts-expect-error TestCache doesn't extend InMemoryCache (the default)
  client.mutate<Data, Variables, TestCache>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<InMemoryCache>();
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
        expectTypeOf(cache).toEqualTypeOf<InMemoryCache>();
      },
    });
  }
});

test("cache.batch", () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.cache.batch({
    update(cache) {
      expectTypeOf(cache).toEqualTypeOf<InMemoryCache>();
    },
    onWatchUpdated() {
      expectTypeOf(this).toEqualTypeOf<InMemoryCache>();
    },
  });
});

test("useApolloClient", () => {
  const client = useApolloClient();

  expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
});

test("useLazyQuery", () => {
  const [, { client }] = useLazyQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
});

test("useMutation", () => {
  {
    const [mutate, { client }] = useMutation(mutation, {
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

    expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
  }

  {
    const [mutate, { client }] = useMutation<Data, Variables>(mutation, {
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

    expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
  }

  // TestCache doesn't extend InMemoryCache, so it cannot be used as TCache without TypeOverrides
  {
    // @ts-expect-error TestCache doesn't extend InMemoryCache (the default)
    const [mutate, { client }] = useMutation<Data, Variables, TestCache>(
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

    expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
  }

  // Ensure TCache can be explicitly set to InMemoryCache
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

    expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
  }
});

test("useQuery", () => {
  const { client } = useQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
});

test("useSuspenseQuery", () => {
  const { client } = useSuspenseQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<InMemoryCache>();
});
