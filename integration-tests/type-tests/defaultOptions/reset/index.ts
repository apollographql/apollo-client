import {
  clientQuery,
  useQuery,
  useLazyQuery,
  useSuspenseQuery,
  useBackgroundQuery,
  useLoadableQuery,
} from "../shared/scenarios.js";

declare module "@apollo/client" {
  export namespace ApolloClient {
    export namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy?: unknown;
        returnPartialData?: unknown;
      }
      interface Query {
        errorPolicy?: unknown;
      }
      interface Mutate {
        errorPolicy?: unknown;
      }
    }
  }
}

import { ApolloClient, InMemoryCache, ApolloLink } from "@apollo/client";
const bool = {} as any as boolean;
// ApolloClient constructor
{
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {},
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { errorPolicy: "none", returnPartialData: true },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { errorPolicy: "none" },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      mutate: { errorPolicy: "none" },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { errorPolicy: "none" },
      watchQuery: { errorPolicy: "none", returnPartialData: true },
      mutate: { errorPolicy: "none" },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { errorPolicy: "all" },
      watchQuery: { errorPolicy: "none", returnPartialData: false },
      mutate: { errorPolicy: "ignore" },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { errorPolicy: "none" },
      watchQuery: { errorPolicy: "ignore", returnPartialData: false },
      mutate: { errorPolicy: "all" },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { errorPolicy: "ignore" },
      watchQuery: {
        errorPolicy: "all",
        returnPartialData: bool,
      },
      mutate: { errorPolicy: "none" },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        // @ts-expect-error: Type '"foo"' is not assignable to type 'ErrorPolicy | undefined'.
        errorPolicy: "foo",
      },
      watchQuery: {
        // @ts-expect-error: Type '"foo"' is not assignable to type 'ErrorPolicy | undefined'.
        errorPolicy: "foo",
        // @ts-expect-error: Type 'number' is not assignable to type 'boolean | undefined'.
        returnPartialData: 1,
      },
      mutate: {
        // @ts-expect-error: Type '"foo"' is not assignable to type 'ErrorPolicy | undefined'.
        errorPolicy: "foo",
      },
    },
  });
}

// client.query
{
  clientQuery.errorPolicy.defaults.toEqualTypeOf<
    Promise<clientQuery.QueryResultNone>
  >;
  clientQuery.errorPolicy.all.toEqualTypeOf<
    Promise<clientQuery.QueryResultAll>
  >;
  clientQuery.errorPolicy.ignore.toEqualTypeOf<
    Promise<clientQuery.QueryResultIgnore>
  >;
  clientQuery.errorPolicy.none.toEqualTypeOf<
    Promise<clientQuery.QueryResultNone>
  >;
}
// useQuery
{
  useQuery.returnPartialData.defaults.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.returnPartialData._true.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.returnPartialData._false.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.returnPartialData._bool.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
}
// useLazyQuery
{
  useLazyQuery.returnPartialData.defaults.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming">
  >;
  useLazyQuery.returnPartialData._true.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useLazyQuery.returnPartialData._false.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming">
  >;
  useLazyQuery.returnPartialData._bool.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
}
// useSuspenseQuery
{
  useSuspenseQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming">
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial">
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming">
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial">
  >;

  useSuspenseQuery.errorPolicy.none.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming">
  >;
  useSuspenseQuery.errorPolicy.none.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial">
  >;
  useSuspenseQuery.errorPolicy.none.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming">
  >;
  useSuspenseQuery.errorPolicy.none.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial">
  >;

  useSuspenseQuery.errorPolicy.all.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty">
  >;
  useSuspenseQuery.errorPolicy.all.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  useSuspenseQuery.errorPolicy.all.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty">
  >;
  useSuspenseQuery.errorPolicy.all.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;

  useSuspenseQuery.errorPolicy.ignore.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty">
  >;
  useSuspenseQuery.errorPolicy.ignore.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  useSuspenseQuery.errorPolicy.ignore.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty">
  >;
  useSuspenseQuery.errorPolicy.ignore.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;

  useSuspenseQuery.skipToken.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty">
  >;
  useSuspenseQuery.skipToken.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty" | "partial">
  >;
  useSuspenseQuery.skipToken.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty">
  >;
  useSuspenseQuery.skipToken.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty" | "partial">
  >;

  useSuspenseQuery.skip._true.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty">
  >;
  useSuspenseQuery.skip._bool.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty">
  >;
  useSuspenseQuery.skip._bool.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty" | "partial">
  >;
  useSuspenseQuery.skip._bool.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty">
  >;
  useSuspenseQuery.skip._bool.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty" | "partial">
  >;
}
// useBackgroundQuery
{
  useBackgroundQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming">
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial">
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._false
    .toEqualTypeOf<useBackgroundQuery.Result<"complete" | "streaming">>;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial">
  >;

  useBackgroundQuery.errorPolicy.none.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming">
  >;
  useBackgroundQuery.errorPolicy.none.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial">
  >;
  useBackgroundQuery.errorPolicy.none.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming">
  >;
  useBackgroundQuery.errorPolicy.none.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial">
  >;

  useBackgroundQuery.errorPolicy.all.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty">
  >;
  useBackgroundQuery.errorPolicy.all.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  useBackgroundQuery.errorPolicy.all.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty">
  >;
  useBackgroundQuery.errorPolicy.all.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;

  useBackgroundQuery.errorPolicy.ignore.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty">
  >;
  useBackgroundQuery.errorPolicy.ignore.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  useBackgroundQuery.errorPolicy.ignore.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty">
  >;
  useBackgroundQuery.errorPolicy.ignore.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;

  useBackgroundQuery.skipToken.result
    .toEqualTypeOf<useBackgroundQuery.UndefinedResult>;

  useBackgroundQuery.skipToken.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial", undefined>
  >;
  useBackgroundQuery.skipToken.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", undefined>
  >;
  useBackgroundQuery.skipToken.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial", undefined>
  >;

  useBackgroundQuery.skip._true.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", undefined>
  >;
  useBackgroundQuery.skip._bool.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", undefined>
  >;
  useBackgroundQuery.skip._bool.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial", undefined>
  >;
  useBackgroundQuery.skip._bool.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", undefined>
  >;
  useBackgroundQuery.skip._bool.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial", undefined>
  >;
}

// useLoadableQuery
{
  useLoadableQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming">
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial">
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming">
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial">
  >;

  useLoadableQuery.errorPolicy.none.result.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming">
  >;
  useLoadableQuery.errorPolicy.none.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial">
  >;
  useLoadableQuery.errorPolicy.none.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming">
  >;
  useLoadableQuery.errorPolicy.none.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial">
  >;

  useLoadableQuery.errorPolicy.all.result.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "empty">
  >;
  useLoadableQuery.errorPolicy.all.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  useLoadableQuery.errorPolicy.all.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "empty">
  >;
  useLoadableQuery.errorPolicy.all.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;

  useLoadableQuery.errorPolicy.ignore.result.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "empty">
  >;
  useLoadableQuery.errorPolicy.ignore.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  useLoadableQuery.errorPolicy.ignore.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "empty">
  >;
  useLoadableQuery.errorPolicy.ignore.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
}
