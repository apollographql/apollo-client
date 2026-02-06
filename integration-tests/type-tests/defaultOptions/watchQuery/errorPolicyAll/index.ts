import { InMemoryCache, type TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink } from "@apollo/client";
import {
  useQuery,
  useSuspenseQuery,
  useBackgroundQuery,
  useLoadableQuery,
  type QueryRef,
} from "@apollo/client/react";
import { expectTypeOf } from "expect-type";

declare module "@apollo/client" {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy: "all";
      }
      interface Query {}
      interface Mutate {}
    }
  }
}

// ApolloClient constructor
{
  // @ts-expect-error: Property 'defaultOptions' is missing in type '{ link: ApolloLink; cache: InMemoryCache; }' but required in type 'Options'.
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
  });

  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    // @ts-expect-error: Property 'watchQuery' is missing in type '{}' but required in type 'DefaultOptions'.
    defaultOptions: {},
  });

  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      // @ts-expect-error: Property 'errorPolicy' is missing in type '{}' but required in type ...
      watchQuery: {},
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        // @ts-expect-error: Type '"none"' is not assignable to type '"all"'.
        errorPolicy: "none",
      },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: "all",
      },
      query: {
        // @ts-expect-error: Type '"all"' is not assignable to type '"A default option for query.errorPolicy must be declared in ApolloClient.DeclareDefaultOptions before usage. See https://www.apollographql.com/docs/react/data/typescript#declaring-default-options-for-type-safety."'.
        errorPolicy: "all",
      },
      mutate: {
        // @ts-expect-error: Type '"all"' is not assignable to type '"A default option for mutate.errorPolicy must be declared in ApolloClient.DeclareDefaultOptions before usage. See https://www.apollographql.com/docs/react/data/typescript#declaring-default-options-for-type-safety."'.
        errorPolicy: "all",
      },
    },
  });

  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: "all",
      },
      query: {
        context: {
          headers: {
            "x-custom-header": "custom-value",
          },
        },
      },
      mutate: {
        awaitRefetchQueries: true,
      },
    },
  });
}

interface Data {
  foo: string;
}
interface Variables {
  bar?: number;
}

declare const client: ApolloClient;
declare const QUERY: TypedDocumentNode<Data, Variables>;
const bool = true as any as boolean;

// client.query
{
  expectTypeOf(client.query({ query: QUERY })).toEqualTypeOf<
    Promise<ApolloClient.QueryResult<Data, "none">>
  >();

  expectTypeOf(
    client.query({ query: QUERY, errorPolicy: "all" })
  ).toEqualTypeOf<Promise<ApolloClient.QueryResult<Data, "all">>>();

  expectTypeOf(
    client.query({ query: QUERY, errorPolicy: "ignore" })
  ).toEqualTypeOf<Promise<ApolloClient.QueryResult<Data, "ignore">>>();
}

// useQuery
{
  expectTypeOf(useQuery(QUERY)).toEqualTypeOf<
    useQuery.Result<Data, Variables, "empty" | "complete" | "streaming">
  >();

  expectTypeOf(useQuery(QUERY, { returnPartialData: true })).toEqualTypeOf<
    useQuery.Result<
      Data,
      Variables,
      "empty" | "complete" | "streaming" | "partial"
    >
  >();

  expectTypeOf(useQuery(QUERY, { returnPartialData: bool })).toEqualTypeOf<
    useQuery.Result<
      Data,
      Variables,
      "empty" | "complete" | "streaming" | "partial"
    >
  >();
}

// useSuspenseQuery
{
  expectTypeOf(useSuspenseQuery(QUERY)).toEqualTypeOf<
    useSuspenseQuery.Result<Data, Variables, "complete" | "streaming" | "empty">
  >();

  expectTypeOf(useSuspenseQuery(QUERY, { errorPolicy: "all" })).toEqualTypeOf<
    useSuspenseQuery.Result<Data, Variables, "complete" | "streaming" | "empty">
  >();

  expectTypeOf(
    useSuspenseQuery(QUERY, { errorPolicy: "ignore" })
  ).toEqualTypeOf<
    useSuspenseQuery.Result<Data, Variables, "complete" | "streaming" | "empty">
  >();

  expectTypeOf(
    useSuspenseQuery(QUERY, { returnPartialData: true })
  ).toEqualTypeOf<
    useSuspenseQuery.Result<
      Data,
      Variables,
      "complete" | "streaming" | "partial" | "empty"
    >
  >();

  expectTypeOf(
    useSuspenseQuery(QUERY, { returnPartialData: bool })
  ).toEqualTypeOf<
    useSuspenseQuery.Result<
      Data,
      Variables,
      "complete" | "streaming" | "empty" | "partial"
    >
  >();

  expectTypeOf(
    useSuspenseQuery(QUERY, { errorPolicy: "all", returnPartialData: true })
  ).toEqualTypeOf<
    useSuspenseQuery.Result<
      Data,
      Variables,
      "complete" | "streaming" | "partial" | "empty"
    >
  >();

  expectTypeOf(
    useSuspenseQuery(QUERY, { errorPolicy: "ignore", returnPartialData: true })
  ).toEqualTypeOf<
    useSuspenseQuery.Result<
      Data,
      Variables,
      "complete" | "streaming" | "partial" | "empty"
    >
  >();
}

// useBackgroundQuery
{
  expectTypeOf(useBackgroundQuery(QUERY)[0]).toEqualTypeOf<
    // @ts-expect-error TODO in a follow-up PR
    QueryRef<Data, Variables, "complete" | "streaming" | "empty">
  >();

  expectTypeOf(
    useBackgroundQuery(QUERY, { errorPolicy: "all" })[0]
  ).toEqualTypeOf<
    QueryRef<Data, Variables, "complete" | "streaming" | "empty">
  >();

  expectTypeOf(
    useBackgroundQuery(QUERY, { errorPolicy: "ignore" })[0]
  ).toEqualTypeOf<
    QueryRef<Data, Variables, "complete" | "streaming" | "empty">
  >();

  expectTypeOf(
    useBackgroundQuery(QUERY, { returnPartialData: true })[0]
  ).toEqualTypeOf<
    QueryRef<Data, Variables, "complete" | "streaming" | "partial" | "empty">
  >();

  expectTypeOf(
    useBackgroundQuery(QUERY, { returnPartialData: bool })[0]
  ).toEqualTypeOf<
    QueryRef<Data, Variables, "complete" | "streaming" | "partial" | "empty">
  >();

  expectTypeOf(
    useBackgroundQuery(QUERY, {
      errorPolicy: "all",
      returnPartialData: true,
    })[0]
  ).toEqualTypeOf<
    QueryRef<Data, Variables, "complete" | "streaming" | "partial" | "empty">
  >();

  expectTypeOf(
    useBackgroundQuery(QUERY, {
      errorPolicy: "ignore",
      returnPartialData: true,
    })[0]
  ).toEqualTypeOf<
    QueryRef<Data, Variables, "complete" | "streaming" | "partial" | "empty">
  >();
}

// useLoadableQuery
{
  expectTypeOf(useLoadableQuery(QUERY)).toEqualTypeOf<
    // @ts-expect-error TODO in a follow-up PR
    useLoadableQuery.Result<Data, Variables, "complete" | "streaming" | "empty">
  >();

  expectTypeOf(useLoadableQuery(QUERY, { errorPolicy: "all" })).toEqualTypeOf<
    useLoadableQuery.Result<Data, Variables, "complete" | "streaming" | "empty">
  >();

  expectTypeOf(
    useLoadableQuery(QUERY, { errorPolicy: "ignore" })
  ).toEqualTypeOf<
    useLoadableQuery.Result<Data, Variables, "complete" | "streaming" | "empty">
  >();

  expectTypeOf(
    useLoadableQuery(QUERY, { returnPartialData: true })
  ).toEqualTypeOf<
    useLoadableQuery.Result<
      Data,
      Variables,
      "complete" | "streaming" | "partial" | "empty"
    >
  >();

  expectTypeOf(
    useLoadableQuery(QUERY, { returnPartialData: bool })
  ).toEqualTypeOf<
    // @ts-expect-error TODO in a follow-up PR
    useLoadableQuery.Result<
      Data,
      Variables,
      "complete" | "streaming" | "empty" | "partial"
    >
  >();

  expectTypeOf(
    useLoadableQuery(QUERY, { errorPolicy: "all", returnPartialData: true })
  ).toEqualTypeOf<
    useLoadableQuery.Result<
      Data,
      Variables,
      "complete" | "streaming" | "partial" | "empty"
    >
  >();

  expectTypeOf(
    useLoadableQuery(QUERY, { errorPolicy: "ignore", returnPartialData: true })
  ).toEqualTypeOf<
    useLoadableQuery.Result<
      Data,
      Variables,
      "complete" | "streaming" | "partial" | "empty"
    >
  >();
}
