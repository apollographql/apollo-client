import { InMemoryCache } from "@apollo/client";
import { ApolloClient, ApolloLink } from "@apollo/client";
import {
  useQuery,
  useLazyQuery,
  useSuspenseQuery,
  useBackgroundQuery,
  useLoadableQuery,
  preloadQuery,
} from "../../shared/scenarios.js";
import { expectTypeOf } from "expect-type";

declare module "@apollo/client" {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy: "none";
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
    // @ts-expect-error: Property 'query' is missing in type '{}' but required in type 'DefaultOptions'.
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
        // @ts-expect-error: Type '"ignore"' is not assignable to type '"none"'.
        errorPolicy: "ignore",
      },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: "none",
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
      query: {
        context: {
          headers: {
            "x-custom-header": "custom-value",
          },
        },
      },
      watchQuery: {
        errorPolicy: "none",
      },
      mutate: {
        awaitRefetchQueries: true,
      },
    },
  });
}

// useQuery
{
  expectTypeOf<useQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none";
    returnPartialData: false;
    skip: false;
  }>();
  useQuery.defaults.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming", "none">
  >;
  useQuery.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useQuery.returnPartialData._false.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming", "none">
  >;
  useQuery.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useQuery.errorPolicy.none.result.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming", "none">
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
    useQuery.Result<"empty" | "complete" | "streaming", "all">
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
    useQuery.Result<"empty" | "complete" | "streaming", "ignore">
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
    useQuery.Result<"empty" | "complete" | "streaming", "none">
  >;
  useQuery.skipToken.returnPartialData._true.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useQuery.skipToken.returnPartialData._bool.branded.toEqualTypeOf<
    useQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
}
// useLazyQuery
{
  expectTypeOf<useLazyQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none";
    returnPartialData: false;
  }>();
  useLazyQuery.defaults.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming", "none">
  >;
  useLazyQuery.returnPartialData._true.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useLazyQuery.returnPartialData._false.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming", "none">
  >;
  useLazyQuery.returnPartialData._bool.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming" | "partial", "none">
  >;
  useLazyQuery.errorPolicy.none.result.branded.toEqualTypeOf<
    useLazyQuery.Result<"empty" | "complete" | "streaming", "none">
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
    useLazyQuery.Result<"empty" | "complete" | "streaming", "all">
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
    useLazyQuery.Result<"empty" | "complete" | "streaming", "ignore">
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
    errorPolicy: "none";
    returnPartialData: false;
    skip: false;
  }>();
  useSuspenseQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming", "none">
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial", "none">
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming", "none">
  >;
  useSuspenseQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "partial", "none">
  >;

  useSuspenseQuery.errorPolicy.none.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming", "none">
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
    useSuspenseQuery.Result<"complete" | "streaming" | "empty", "all">
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
    useSuspenseQuery.Result<"complete" | "streaming" | "empty", "ignore">
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
    useSuspenseQuery.Result<"complete" | "streaming" | "empty", "none">
  >;
  useSuspenseQuery.skipToken.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none"
    >
  >;
  useSuspenseQuery.skipToken.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty", "none">
  >;
  useSuspenseQuery.skipToken.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none"
    >
  >;

  useSuspenseQuery.skip._true.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty", "none">
  >;
  useSuspenseQuery.skip._bool.result.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty", "none">
  >;
  useSuspenseQuery.skip._bool.returnPartialData._true.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none"
    >
  >;
  useSuspenseQuery.skip._bool.returnPartialData._false.toEqualTypeOf<
    useSuspenseQuery.Result<"complete" | "streaming" | "empty", "none">
  >;
  useSuspenseQuery.skip._bool.returnPartialData._bool.toEqualTypeOf<
    useSuspenseQuery.Result<
      "complete" | "streaming" | "empty" | "partial",
      "none"
    >
  >;
}
// useBackgroundQuery
{
  expectTypeOf<useBackgroundQuery.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none";
    returnPartialData: false;
    skip: false;
  }>();
  useBackgroundQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", "none">
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial", "none">
  >;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._false
    .toEqualTypeOf<useBackgroundQuery.Result<"complete" | "streaming", "none">>;
  useBackgroundQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming" | "partial", "none">
  >;

  useBackgroundQuery.errorPolicy.none.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", "none">
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
    useBackgroundQuery.Result<"complete" | "streaming" | "empty", "all">
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
    useBackgroundQuery.Result<"complete" | "streaming" | "empty", "ignore">
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
    useBackgroundQuery.UndefinedResult<"none">
  >;

  useBackgroundQuery.skipToken.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial",
      "none",
      undefined
    >
  >;
  useBackgroundQuery.skipToken.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", "none", undefined>
  >;
  useBackgroundQuery.skipToken.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial",
      "none",
      undefined
    >
  >;

  useBackgroundQuery.skip._true.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", "none", undefined>
  >;
  useBackgroundQuery.skip._bool.result.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", "none", undefined>
  >;
  useBackgroundQuery.skip._bool.returnPartialData._true.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial",
      "none",
      undefined
    >
  >;
  useBackgroundQuery.skip._bool.returnPartialData._false.toEqualTypeOf<
    useBackgroundQuery.Result<"complete" | "streaming", "none", undefined>
  >;
  useBackgroundQuery.skip._bool.returnPartialData._bool.toEqualTypeOf<
    useBackgroundQuery.Result<
      "complete" | "streaming" | "partial",
      "none",
      undefined
    >
  >;
}

// preloadQuery
{
  expectTypeOf<preloadQuery.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "none";
    returnPartialData: false;
  }>();
  preloadQuery.errorPolicy.defaults.result.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming">
  >;
  preloadQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial">
  >;
  preloadQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming">
  >;
  preloadQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming" | "partial">
  >;

  preloadQuery.errorPolicy.none.result.toEqualTypeOf<
    preloadQuery.Result<"complete" | "streaming">
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
    preloadQuery.Result<"complete" | "streaming" | "empty">
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
    preloadQuery.Result<"complete" | "streaming" | "empty">
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
    errorPolicy: "none";
    returnPartialData: false;
  }>();
  useLoadableQuery.errorPolicy.defaults.result.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming", "none">
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._true.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial", "none">
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._false.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming", "none">
  >;
  useLoadableQuery.errorPolicy.defaults.returnPartialData._bool.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming" | "partial", "none">
  >;

  useLoadableQuery.errorPolicy.none.result.toEqualTypeOf<
    useLoadableQuery.Result<"complete" | "streaming", "none">
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
    useLoadableQuery.Result<"complete" | "streaming" | "empty", "all">
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
    useLoadableQuery.Result<"complete" | "streaming" | "empty", "ignore">
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
