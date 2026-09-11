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

declare module "@apollo/client" {
  export interface TypeOverrides {
    cache: number;
  }
}
type Data = { foo: string };
type Variables = { bar?: string };

declare const mutation: TypedDocumentNode<Data, Variables>;
declare const query: TypedDocumentNode<Data, Variables>;

type WrongCacheMessage =
  "The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.";

test("ApolloClient constructor", () => {
  {
    const client = new ApolloClient({
      // @ts-expect-error The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
  }

  {
    const client = new ApolloClient({
      // @ts-expect-error The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.
      cache: new TestCache(),
      link: ApolloLink.empty(),
    });

    expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
  }

  {
    const client = new ApolloClient({
      // @ts-expect-error The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.
      cache: 123,
      link: ApolloLink.empty(),
    });

    expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
  }
});

test("client.mutate", () => {
  const client = new ApolloClient({
    // @ts-expect-error The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.
    cache: new TestCache(),
    link: ApolloLink.empty(),
  });

  client.mutate({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
    },
  });

  client.mutate<Data, Variables>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
    },
  });

  // @ts-expect-error The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.
  client.mutate<Data, Variables, TestCache>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
    },
  });

  // @ts-expect-error The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.
  client.mutate<Data, Variables, InMemoryCache>({
    mutation,
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
    },
  });
});

test("client.refetchQueries", () => {
  {
    const client = new ApolloClient({
      // @ts-expect-error The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    client.refetchQueries({
      updateCache: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
      },
    });
  }

  {
    const client = new ApolloClient({
      // @ts-expect-error The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.
      cache: new TestCache(),
      link: ApolloLink.empty(),
    });

    client.refetchQueries({
      updateCache: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
      },
    });
  }
});

test("cache.batch", () => {
  const client = new ApolloClient({
    // @ts-expect-error The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.
    cache: new TestCache(),
    link: ApolloLink.empty(),
  });

  // @ts-expect-error property 'batch' doesn't exist in 'The cache type declared in TypeOverrides does not extend `ApolloCache` and cannot be used with Apollo Client. See https://www.apollographql.com/docs/react/data/typescript#declaring-the-cache-type.'
  client.cache.batch({
    // @ts-expect-error inferred any
    update(cache) {
      expectTypeOf(cache).toEqualTypeOf<any>();
    },
    onWatchUpdated() {
      expectTypeOf(this).toEqualTypeOf<any>();
    },
  });
});

test("useApolloClient", () => {
  const client = useApolloClient();

  expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
});

test("useLazyQuery", () => {
  const [, { client }] = useLazyQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
});

test("useMutation", () => {
  {
    const [mutate, { client }] = useMutation(mutation, {
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
    });

    mutate({
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
    });

    expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
  }

  {
    const [mutate, { client }] = useMutation<Data, Variables>(mutation, {
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
    });

    mutate({
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
    });

    expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
  }

  {
    const [mutate, { client }] = useMutation<
      Data,
      Variables,
      WrongCacheMessage
    >(mutation, {
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
    });

    mutate({
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<WrongCacheMessage>();
      },
      onCompleted: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
      onError: (_, options) => {
        expectTypeOf(options!.update!).toEqualTypeOf<
          MutationUpdaterFunction<Data, Variables, WrongCacheMessage>
        >;
      },
    });

    expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
  }
});

test("useQuery", () => {
  const { client } = useQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
});

test("useSuspenseQuery", () => {
  const { client } = useSuspenseQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<WrongCacheMessage>();
});
