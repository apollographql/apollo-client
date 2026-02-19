import { InMemoryCache } from "@apollo/client";
import { ApolloClient, ApolloLink } from "@apollo/client";
import { clientQuery } from "../../shared/scenarios.js";

declare module "@apollo/client" {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {}
      interface Query {
        errorPolicy: "all";
      }
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
      query: {},
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
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
        // @ts-expect-error: Type '"all"' is not assignable to type '"A default option for watchQuery.errorPolicy must be declared in ApolloClient.DeclareDefaultOptions before usage. See https://www.apollographql.com/docs/react/data/typescript#declaring-default-options-for-type-safety."'.
        errorPolicy: "all",
      },
      query: {
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
        context: {
          headers: {
            "x-custom-header": "custom-value",
          },
        },
      },
      query: {
        errorPolicy: "all",
      },
      mutate: {
        awaitRefetchQueries: true,
      },
    },
  });
}

// client.query
{
  clientQuery.errorPolicy.defaults.branded.toEqualTypeOf<
    Promise<clientQuery.QueryResultAll>
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
