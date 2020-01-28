// The `graphql-tag` package currently ships with types that aren't quite
// representative of how the package is setup, and its exports are handled.
// This type file is intended to better reflect how the package is setup,
// but should be considered temporary. At some point `graphql-tag` will
// be fully updated to use Typescript, and these discrepancies will be fixed.

declare module 'graphql-tag' {
  function gql(literals: any, ...placeholders: any[]): any;
  namespace gql {
    export function resetCaches(): void;
    export function disableFragmentWarnings(): void;
    export function enableExperimentalFragmentVariables(): void;
    export function disableExperimentalFragmentVariables(): void;
  }
  export default gql;
}
