import {
  ApolloCache,
  ApolloClient,
  ApolloLink,
  DocumentNode,
  InMemoryCache,
  MutationUpdaterFunction,
  OperationVariables,
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

declare const mutation: DocumentNode;
declare const query: DocumentNode;

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
});

test("client.mutate", () => {
  {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    client.mutate({
      mutation,
      update: (cache) => {
        expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
      },
    });
  }

  {
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
  }
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

test("useApolloClient", () => {
  const client = useApolloClient();

  expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
});

test("useLazyQuery", () => {
  const [, { client }] = useLazyQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
});

test("useMutation", () => {
  const [mutate, { client }] = useMutation(mutation, {
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
    },
    onCompleted: (_, options) => {
      expectTypeOf(options!.update!).toEqualTypeOf<
        MutationUpdaterFunction<unknown, OperationVariables, ApolloCache>
      >;
    },
    onError: (_, options) => {
      expectTypeOf(options!.update!).toEqualTypeOf<
        MutationUpdaterFunction<unknown, OperationVariables, ApolloCache>
      >;
    },
  });

  mutate({
    update: (cache) => {
      expectTypeOf(cache).toEqualTypeOf<ApolloCache>();
    },
    onCompleted: (_, options) => {
      expectTypeOf(options!.update!).toEqualTypeOf<
        MutationUpdaterFunction<unknown, OperationVariables, ApolloCache>
      >;
    },
    onError: (_, options) => {
      expectTypeOf(options!.update!).toEqualTypeOf<
        MutationUpdaterFunction<unknown, OperationVariables, ApolloCache>
      >;
    },
  });

  expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
});

test("useQuery", () => {
  const { client } = useQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
});

test("useSuspenseQuery", () => {
  const { client } = useSuspenseQuery(query);

  expectTypeOf(client.cache).toEqualTypeOf<ApolloCache>();
});
