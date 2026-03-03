import { expectTypeOf } from "expect-type";
import { ApolloClient, InMemoryCache, ApolloLink } from "@apollo/client";

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
