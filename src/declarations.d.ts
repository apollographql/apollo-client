import type { InternalTypes } from "@apollo/client";

declare module "@apollo/client" {
  // in our own codebase, we have to account for all possible `defaultOptions`s
  export namespace ApolloClient {
    export namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy?: InternalTypes.PossibleDefaultOptions.WatchQuery["errorPolicy"];
        returnPartialData?: InternalTypes.PossibleDefaultOptions.WatchQuery["returnPartialData"];
      }
      interface Query {
        errorPolicy?: InternalTypes.PossibleDefaultOptions.Query["errorPolicy"];
      }
      interface Mutate {
        errorPolicy?: InternalTypes.PossibleDefaultOptions.Mutate["errorPolicy"];
      }
    }
  }
}
