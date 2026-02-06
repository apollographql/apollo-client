// This pattern can be used to reset Apollo Client to the pre-4.2 behaviour,
// allowing to set any default option to any value, without type errors.
// This is generally not recommended as it is less type-safe, but it might be
// useful for projects that contain multiple Apollo Client instances with
// different default options.
import type {} from "@apollo/client";
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
