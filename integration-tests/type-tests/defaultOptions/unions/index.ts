import { expectTypeOf } from "expect-type";
import {
  clientMutate,
  clientQuery,
  useQuery,
  useLazyQuery,
  useSuspenseQuery,
  useBackgroundQuery,
  useLoadableQuery,
  useMutation,
  preloadQuery,
} from "../shared/scenarios.js";
import { ApolloClient, InMemoryCache, ApolloLink } from "@apollo/client";

declare module "@apollo/client" {
  export namespace ApolloClient {
    export namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy?: "none" | "ignore" | "all";
        returnPartialData?: boolean;
      }
      interface Query {
        errorPolicy?: "none" | "ignore" | "all";
      }
      interface Mutate {
        errorPolicy?: "none" | "ignore" | "all";
      }
    }
  }
}

expectTypeOf<ApolloClient.DefaultOptions.WatchQuery.Calculated>()
  .toEqualTypeOf<{
  // undefined should be replaced with "none", merged in with existing "none"
  errorPolicy: "none" | "ignore" | "all";
  // undefined should be replaced with "false", merged in with existing "boolean"
  returnPartialData: boolean;
}>;

expectTypeOf<ApolloClient.DefaultOptions.Query.Calculated>().toEqualTypeOf<{
  // undefined should be replaced with "none", merged in with existing "none"
  errorPolicy: "none" | "ignore" | "all";
}>;

expectTypeOf<ApolloClient.DefaultOptions.Mutate.Calculated>().toEqualTypeOf<{
  // undefined should be replaced with "none", merged in with existing "none"
  errorPolicy: "none" | "ignore" | "all";
}>;

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

// client.mutate
{
  expectTypeOf<ApolloClient.mutate.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
  }>();
  clientMutate.defaults.branded.toEqualTypeOf<
    Promise<
      | clientMutate.MutateResultNone
      | clientMutate.MutateResultAll
      | clientMutate.MutateResultIgnore
    >
  >();
  clientMutate.errorPolicy.all.branded.toEqualTypeOf<
    Promise<clientMutate.MutateResultAll>
  >();
  clientMutate.errorPolicy.ignore.branded.toEqualTypeOf<
    Promise<clientMutate.MutateResultIgnore>
  >();
  clientMutate.errorPolicy.none.branded.toEqualTypeOf<
    Promise<clientMutate.MutateResultNone>
  >();
}

// client.query
{
  expectTypeOf<ApolloClient.query.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
  }>();
  clientQuery.defaults.branded.toEqualTypeOf<
    Promise<
      | clientQuery.QueryResultNone
      | clientQuery.QueryResultAll
      | clientQuery.QueryResultIgnore
    >
  >();
  clientQuery.errorPolicy.all.branded.toEqualTypeOf<
    Promise<clientQuery.QueryResultAll>
  >();
  clientQuery.errorPolicy.ignore.branded.toEqualTypeOf<
    Promise<clientQuery.QueryResultIgnore>
  >();
  clientQuery.errorPolicy.none.branded.toEqualTypeOf<
    Promise<clientQuery.QueryResultNone>
  >();
}

// useMutation
{
  expectTypeOf<useMutation.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
  }>();
  useMutation.defaults.branded.toEqualTypeOf<
    useMutation.ResultTuple<"none" | "ignore" | "all">
  >;
  useMutation.errorPolicy.all.branded.toEqualTypeOf<
    useMutation.ResultTuple<"all">
  >;
  useMutation.errorPolicy.ignore.branded.toEqualTypeOf<
    useMutation.ResultTuple<"ignore">
  >;
  useMutation.errorPolicy.none.branded.toEqualTypeOf<
    useMutation.ResultTuple<"none">
  >;
}

// useQuery
{
  expectTypeOf<useQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: boolean;
    skip: false;
  }>();
  useQuery.defaults.branded.toEqualTypeOf<
    useQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useQuery.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useQuery.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<
      "empty" | "complete" | "streaming",
      "none" | "ignore" | "all"
    >
  >;
  useQuery.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useQuery.errorPolicy.none.result.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useQuery.errorPolicy.none.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming", "none">
  >;
  useQuery.errorPolicy.none.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useQuery.errorPolicy.none.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useQuery.errorPolicy.all.result.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "all">
  >;
  useQuery.errorPolicy.all.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming", "all">
  >;
  useQuery.errorPolicy.all.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "all">
  >;
  useQuery.errorPolicy.all.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "all">
  >;
  useQuery.errorPolicy.ignore.result.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "ignore">
  >;
  useQuery.errorPolicy.ignore.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming", "ignore">
  >;
  useQuery.errorPolicy.ignore.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "ignore">
  >;
  useQuery.errorPolicy.ignore.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "ignore">
  >;
  useQuery.skipToken.result.toEqualTypeOf<
    useQuery.Result<"empty", undefined, Record<string, never>>
  >;
  useQuery.skipToken.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<
      "empty" | "complete" | "streaming",
      "none" | "ignore" | "all"
    >
  >;
  useQuery.skipToken.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useQuery.skipToken.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
}
// useLazyQuery
{
  expectTypeOf<useLazyQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: boolean;
  }>();
  useLazyQuery.defaults.toEqualTypeOf<
    useLazyQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useLazyQuery.returnPartialData._true.toEqualTypeOf<
    useLazyQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useLazyQuery.returnPartialData._false.toEqualTypeOf<
    useLazyQuery.Result<
      "empty" | "complete" | "streaming",
      "none" | "ignore" | "all"
    >
  >;
  useLazyQuery.returnPartialData._bool.toEqualTypeOf<
    useLazyQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useLazyQuery.errorPolicy.none.result.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useLazyQuery.errorPolicy.none.returnPartialData._false.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming", "none">
  >;
  useLazyQuery.errorPolicy.none.returnPartialData._true.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useLazyQuery.errorPolicy.none.returnPartialData._bool.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useLazyQuery.errorPolicy.all.result.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial", "all">
  >;
  useLazyQuery.errorPolicy.all.returnPartialData._false.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming", "all">
  >;
  useLazyQuery.errorPolicy.all.returnPartialData._true.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial", "all">
  >;
  useLazyQuery.errorPolicy.all.returnPartialData._bool.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial", "all">
  >;
  useLazyQuery.errorPolicy.ignore.result.branded.toEqualTypeOf<
    useLazyQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "ignore"
    >
  >;
  useLazyQuery.errorPolicy.ignore.returnPartialData._false.branded
    .toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming", "ignore">
  >;
  useLazyQuery.errorPolicy.ignore.returnPartialData._true.branded.toEqualTypeOf<
    useLazyQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "ignore"
    >
  >;
  useLazyQuery.errorPolicy.ignore.returnPartialData._bool.branded.toEqualTypeOf<
    useLazyQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "ignore"
    >
  >;
}
// useSuspenseQuery
{
  expectTypeOf<useSuspenseQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: boolean;
    skip: false;
  }>();
  useSuspenseQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useSuspenseQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<
      "empty" | "complete" | "streaming",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<
      "empty" | "complete" | "streaming" | "partial",
      "none" | "ignore" | "all"
    >
  >;

  useSuspenseQuery.errorPolicy.none.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial", "none">
  >;
  useSuspenseQuery.errorPolicy.none.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial", "none">
  >;
  useSuspenseQuery.errorPolicy.none.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming", "none">
  >;
  useSuspenseQuery.errorPolicy.none.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial", "none">
  >;

  useSuspenseQuery.errorPolicy.all.result.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "all"
    >
  >;
  useSuspenseQuery.errorPolicy.all.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "all"
    >
  >;
  useSuspenseQuery.errorPolicy.all.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty", "all">
  >;
  useSuspenseQuery.errorPolicy.all.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "all"
    >
  >;

  useSuspenseQuery.errorPolicy.ignore.result.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "ignore"
    >
  >;
  useSuspenseQuery.errorPolicy.ignore.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "ignore"
    >
  >;
  useSuspenseQuery.errorPolicy.ignore.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty", "ignore">
  >;
  useSuspenseQuery.errorPolicy.ignore.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "ignore"
    >
  >;

  useSuspenseQuery.skipToken.result.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.skipToken.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.skipToken.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.skipToken.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none" | "ignore" | "all"
    >
  >;

  useSuspenseQuery.skip._true.result.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.skip._bool.result.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.skip._bool.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.skip._bool.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty",
      "none" | "ignore" | "all"
    >
  >;
  useSuspenseQuery.skip._bool.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none" | "ignore" | "all"
    >
  >;
}
// useBackgroundQuery
{
  expectTypeOf<useBackgroundQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: boolean;
    skip: false;
  }>();
  useBackgroundQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all"
    >
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all"
    >
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._false
    .toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "empty",
      "none" | "ignore" | "all"
    >
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all"
    >
  >;

  useBackgroundQuery.errorPolicy.none.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial", "none">
  >;
  useBackgroundQuery.errorPolicy.none.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial", "none">
  >;
  useBackgroundQuery.errorPolicy.none.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", "none">
  >;
  useBackgroundQuery.errorPolicy.none.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial", "none">
  >;

  useBackgroundQuery.errorPolicy.all.result.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "all"
    >
  >;
  useBackgroundQuery.errorPolicy.all.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "all"
    >
  >;
  useBackgroundQuery.errorPolicy.all.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty", "all">
  >;
  useBackgroundQuery.errorPolicy.all.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "all"
    >
  >;

  useBackgroundQuery.errorPolicy.ignore.result.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "ignore"
    >
  >;
  useBackgroundQuery.errorPolicy.ignore.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "ignore"
    >
  >;
  useBackgroundQuery.errorPolicy.ignore.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty", "ignore">
  >;
  useBackgroundQuery.errorPolicy.ignore.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "ignore"
    >
  >;

  useBackgroundQuery.skipToken.result.toEqualTypeOf<
    useBackgroundQuery.UndefinedResult<"none" | "ignore" | "all">
  >;

  useBackgroundQuery.skipToken.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all",
      undefined
    >
  >;
  useBackgroundQuery.skipToken.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "empty",
      "none" | "ignore" | "all",
      undefined
    >
  >;
  useBackgroundQuery.skipToken.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all",
      undefined
    >
  >;

  useBackgroundQuery.skip._true.result.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all",
      undefined
    >
  >;
  useBackgroundQuery.skip._bool.result.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all",
      undefined
    >
  >;
  useBackgroundQuery.skip._bool.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all",
      undefined
    >
  >;
  useBackgroundQuery.skip._bool.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "empty",
      "none" | "ignore" | "all",
      undefined
    >
  >;
  useBackgroundQuery.skip._bool.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all",
      undefined
    >
  >;
}

// preloadQuery
{
  expectTypeOf<preloadQuery.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: boolean;
  }>();
  preloadQuery.errorPolicy.defaults.result.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  preloadQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  preloadQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "empty">
  >;
  preloadQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;

  preloadQuery.errorPolicy.none.result.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial">
  >;
  preloadQuery.errorPolicy.none.returnPartialData._true.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial">
  >;
  preloadQuery.errorPolicy.none.returnPartialData._false.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming">
  >;
  preloadQuery.errorPolicy.none.returnPartialData._bool.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial">
  >;

  preloadQuery.errorPolicy.all.result.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "empty" | "partial">
  >;
  preloadQuery.errorPolicy.all.returnPartialData._true.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  preloadQuery.errorPolicy.all.returnPartialData._false.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "empty">
  >;
  preloadQuery.errorPolicy.all.returnPartialData._bool.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;

  preloadQuery.errorPolicy.ignore.result.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "empty" | "partial">
  >;
  preloadQuery.errorPolicy.ignore.returnPartialData._true.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  preloadQuery.errorPolicy.ignore.returnPartialData._false.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "empty">
  >;
  preloadQuery.errorPolicy.ignore.returnPartialData._bool.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
}

// useLoadableQuery
{
  expectTypeOf<useLoadableQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: boolean;
  }>();
  useLoadableQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all"
    >
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all"
    >
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "empty",
      "none" | "ignore" | "all"
    >
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "none" | "ignore" | "all"
    >
  >;

  useLoadableQuery.errorPolicy.none.result.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial", "none">
  >;
  useLoadableQuery.errorPolicy.none.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial", "none">
  >;
  useLoadableQuery.errorPolicy.none.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming", "none">
  >;
  useLoadableQuery.errorPolicy.none.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial", "none">
  >;

  useLoadableQuery.errorPolicy.all.result.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "all"
    >
  >;
  useLoadableQuery.errorPolicy.all.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "all"
    >
  >;
  useLoadableQuery.errorPolicy.all.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "empty", "all">
  >;
  useLoadableQuery.errorPolicy.all.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "all"
    >
  >;

  useLoadableQuery.errorPolicy.ignore.result.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "ignore"
    >
  >;
  useLoadableQuery.errorPolicy.ignore.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "ignore"
    >
  >;
  useLoadableQuery.errorPolicy.ignore.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "empty", "ignore">
  >;
  useLoadableQuery.errorPolicy.ignore.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      "ignore"
    >
  >;
}
