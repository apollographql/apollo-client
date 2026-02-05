import type { InternalTypes } from "@apollo/client";

declare module "@apollo/client" {
  // in our own codebase, we have to account for all possible `defaultOptions`s
  export namespace ApolloClient {
    export namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy?: NonNullable<
          InternalTypes.PossibleDefaultOptions.WatchQuery["errorPolicy"]
        >;
      }
      interface Query {
        errorPolicy?: NonNullable<
          InternalTypes.PossibleDefaultOptions.Query["errorPolicy"]
        >;
      }
      interface Mutate {
        errorPolicy?: NonNullable<
          InternalTypes.PossibleDefaultOptions.Mutate["errorPolicy"]
        >;
      }
    }
  }
}
