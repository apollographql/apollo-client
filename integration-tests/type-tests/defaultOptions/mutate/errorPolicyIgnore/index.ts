import { InMemoryCache } from "@apollo/client";
import { ApolloClient, ApolloLink } from "@apollo/client";
import { clientMutate, useMutation } from "../../shared/scenarios.js";
import { expectTypeOf } from "expect-type";

declare module "@apollo/client" {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {}
      interface Query {}
      interface Mutate {
        errorPolicy: "ignore";
      }
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
    // @ts-expect-error: Property 'mutate' is missing in type '{}' but required in type 'DefaultOptions'.
    defaultOptions: {},
  });

  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      // @ts-expect-error: Property 'errorPolicy' is missing in type '{}' but required in type ...
      mutate: {},
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      mutate: {
        // @ts-expect-error: Type '"all"' is not assignable to type '"ignore"'.
        errorPolicy: "all",
      },
    },
  });
  new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache(),
    defaultOptions: {
      mutate: {
        errorPolicy: "ignore",
      },
    },
  });
}

// client.mutate
{
  expectTypeOf<ApolloClient.mutate.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "ignore";
  }>();
  clientMutate.defaults.branded.toEqualTypeOf<
    Promise<clientMutate.MutateResultIgnore>
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

// useMutation
{
  expectTypeOf<useMutation.hook.DefaultOptions>().toEqualTypeOf<{
    errorPolicy: "ignore";
  }>();
  useMutation.defaults.branded.toEqualTypeOf<
    useMutation.ResultTuple<"ignore">
  >();
  useMutation.errorPolicy.all.branded.toEqualTypeOf<
    useMutation.ResultTuple<"all">
  >();
  useMutation.errorPolicy.ignore.branded.toEqualTypeOf<
    useMutation.ResultTuple<"ignore">
  >();
  useMutation.errorPolicy.none.branded.toEqualTypeOf<
    useMutation.ResultTuple<"none">
  >();
}
