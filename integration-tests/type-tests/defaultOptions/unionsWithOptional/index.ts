import { expectTypeOf } from "expect-type";
import { ApolloClient, InMemoryCache, ApolloLink } from "@apollo/client";
import {
  clientQuery,
  useBackgroundQuery,
  useLazyQuery,
  useLoadableQuery,
  useQuery,
  useSuspenseQuery,
} from "../shared/scenarios.js";

declare module "@apollo/client" {
  export namespace ApolloClient {
    export namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy?: "ignore" | "all";
        returnPartialData?: never;
      }
      interface Query {
        errorPolicy?: "ignore" | "all";
      }
      interface Mutate {
        errorPolicy?: "ignore" | "all";
      }
    }
  }
}

expectTypeOf<ApolloClient.DefaultOptions.WatchQuery.Calculated>()
  .toEqualTypeOf<{
  // undefined should be replaced with "none"
  errorPolicy: "none" | "ignore" | "all";
  // undefined should be replaced with "false"
  returnPartialData: false;
}>;

expectTypeOf<ApolloClient.DefaultOptions.Query.Calculated>().toEqualTypeOf<{
  // undefined should be replaced with "none"
  errorPolicy: "none" | "ignore" | "all";
}>;

expectTypeOf<ApolloClient.DefaultOptions.Mutate.Calculated>().toEqualTypeOf<{
  // undefined should be replaced with "none"
  errorPolicy: "none" | "ignore" | "all";
}>;

expectTypeOf<ApolloClient.query.DefaultOptions>().toEqualTypeOf<{
  errorPolicy: "none" | "ignore" | "all";
}>();

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
      query: { errorPolicy: "all" },
      watchQuery: {},
      mutate: { errorPolicy: "ignore" },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {},
      watchQuery: { errorPolicy: "ignore" },
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
      },
      mutate: {},
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        // @ts-expect-error: Type '"foo"' is not assignable to type '"ignore" | "all" | undefined'.
        errorPolicy: "foo",
      },
      watchQuery: {
        // @ts-expect-error: Type '"foo"' is not assignable to type '"ignore" | "all" | undefined''.
        errorPolicy: "foo",
        // @ts-expect-error: Type 'number' is not assignable to type 'boolean | undefined'.
        returnPartialData: 1,
      },
      mutate: {
        // @ts-expect-error: Type '"foo"' is not assignable to type '"ignore" | "all" | undefined''.
        errorPolicy: "foo",
      },
    },
  });
}

// client.query
{
  expectTypeOf<ApolloClient.query.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
  }>();
  clientQuery.errorPolicy.defaults.branded.toEqualTypeOf<
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

// useQuery
{
  expectTypeOf<useQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: false;
    skip: false;
  }>();
  useQuery.defaults.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.errorPolicy.none.result.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.errorPolicy.none.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.errorPolicy.none.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.errorPolicy.none.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.errorPolicy.all.result.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.errorPolicy.all.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.errorPolicy.all.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.errorPolicy.all.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.errorPolicy.ignore.result.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.errorPolicy.ignore.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.errorPolicy.ignore.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.errorPolicy.ignore.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.skipToken.result.toEqualTypeOf<
    useQuery.Result<"empty", Record<string, never>>
  >;
  useQuery.skipToken.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming">
  >;
  useQuery.skipToken.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useQuery.skipToken.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
}
// useLazyQuery
{
  expectTypeOf<useLazyQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: false;
  }>();
  useLazyQuery.defaults.toEqualTypeOf<
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
  useLazyQuery.errorPolicy.none.result.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming">
  >;
  useLazyQuery.errorPolicy.none.returnPartialData._false.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming">
  >;
  useLazyQuery.errorPolicy.none.returnPartialData._true.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useLazyQuery.errorPolicy.none.returnPartialData._bool.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useLazyQuery.errorPolicy.all.result.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming">
  >;
  useLazyQuery.errorPolicy.all.returnPartialData._false.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming">
  >;
  useLazyQuery.errorPolicy.all.returnPartialData._true.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useLazyQuery.errorPolicy.all.returnPartialData._bool.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useLazyQuery.errorPolicy.ignore.result.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming">
  >;
  useLazyQuery.errorPolicy.ignore.returnPartialData._false.branded
    .toEqualTypeOf<useLazyQuery.Result<"empty" | "complete" | "streaming">>;
  useLazyQuery.errorPolicy.ignore.returnPartialData._true.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useLazyQuery.errorPolicy.ignore.returnPartialData._bool.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
}
// useSuspenseQuery
{
  expectTypeOf<useSuspenseQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: false;
    skip: false;
  }>();
  useSuspenseQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useSuspenseQuery.Result<"empty" | "complete" | "streaming">
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<"empty" | "complete" | "streaming" | "partial">
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"empty" | "complete" | "streaming">
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<"empty" | "complete" | "streaming" | "partial">
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
  expectTypeOf<useBackgroundQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: false;
    skip: false;
  }>();
  useBackgroundQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty">
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._false
    .toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty">
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial" | "empty">
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
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      undefined
    >
  >;
  useBackgroundQuery.skipToken.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty", undefined>
  >;
  useBackgroundQuery.skipToken.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      undefined
    >
  >;

  useBackgroundQuery.skip._true.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty", undefined>
  >;
  useBackgroundQuery.skip._bool.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty", undefined>
  >;
  useBackgroundQuery.skip._bool.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      undefined
    >
  >;
  useBackgroundQuery.skip._bool.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "empty", undefined>
  >;
  useBackgroundQuery.skip._bool.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial" | "empty",
      undefined
    >
  >;
}

// useLoadableQuery
{
  expectTypeOf<useLoadableQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none" | "ignore" | "all";
    returnPartialData: false;
  }>();
  useLoadableQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "empty">
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial" | "empty">
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "empty">
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial" | "empty">
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
