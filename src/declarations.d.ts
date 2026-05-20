import type { InternalTypes } from "@apollo/client";

declare module "@apollo/client" {
  // in our own codebase, we have to account for all possible `defaultOptions`s
  export namespace ApolloClient {
    export namespace DeclareDefaultOptions {
      interface WatchQuery {}
      interface Query {}
      interface Mutate {}
    }
  }
}
