import {
  ApolloClient,
  ApolloLink,
  Cache,
  TypedDocumentNode,
  MutationUpdaterFunction,
  ApolloCache,
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

declare module "@apollo/client" {
  export interface TypeOverrides {
    cache: TestCache;
    signatureStyle: "classic";
  }
}

type Data = { foo: string };
type Variables = { bar?: string };

declare const mutation: TypedDocumentNode<Data, Variables>;
declare const query: TypedDocumentNode<Data, Variables>;

test("ApolloClient constructor", () => {
  {
    const client = new ApolloClient({
      // @ts-expect-error cache isn't TestCache
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
  }

  {
    const client = new ApolloClient({
      cache: new TestCache(),
      link: ApolloLink.empty(),
    });

    expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
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
      expectTypeOf(cache).toEqualTypeOf<TestCache>();
    },
  });

  client.mutate<Data, Variables>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<TestCache>();
    },
  });

  // @ts-expect-error wrong TCache subtype
  client.mutate<Data, Variables, ApolloCache>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<TestCache>();
    },
  });

  client.mutate<Data, Variables, TestCache>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<TestCache>();
    },
  });

  client.mutate<Data, Variables, Cache.Implementation>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<TestCache>();
    },
  });
});

test("client.refetchQueries", () => {
  const client = new ApolloClient({
    cache: new TestCache(),
    link: ApolloLink.empty(),
  });

  client.refetchQueries({
    updateCache: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<TestCache>();
    },
  });

  // @ts-expect-error wrong TCache subtype
  client.refetchQueries<ApolloCache>({
    updateCache: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
    },
  });

  client.refetchQueries<TestCache>({
    updateCache: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<TestCache>();
    },
  });

  client.refetchQueries<Cache.Implementation>({
    updateCache: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<TestCache>();
    },
  });
});

test("useApolloClient", () => {
  const client = useApolloClient();

  expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
});

test("useLazyQuery", () => {
  const [, { client }] = useLazyQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
});

test("useMutation", () => {
  {
    const [mutate, { client }] = useMutation(mutation, {
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

    expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
  }

  {
    const [mutate, { client }] = useMutation<Data, Variables>(mutation, {
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

    expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
  }

  {
    // @ts-expect-error wrong TCache subtype
    const [mutate, { client }] = useMutation<Data, Variables, ApolloCache>(
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

    expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
  }

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

    expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
  }

  {
    const [mutate, { client }] = useMutation<
      Data,
      Variables,
      Cache.Implementation
    >(mutation, {
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

    expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
  }
});

test("useQuery", () => {
  const { client } = useQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
});

test("useSuspenseQuery", () => {
  const { client } = useSuspenseQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<TestCache>();
});
