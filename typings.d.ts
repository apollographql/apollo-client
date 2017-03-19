/*

  GRAPHQL

*/
declare module 'graphql-tag/parser' {
  import { Source, ParseOptions, DocumentNode } from 'graphql';
  // XXX figure out how to directly export this method
  function parse(
      source: Source | string,
      options?: ParseOptions
  ): DocumentNode;
}

declare module 'graphql-tag/bundledPrinter' {
  function print(ast: any): string;
}

declare module 'unfetch' {
  // Uses the type of fetch from `@types/whatwg-fetch`.
  const _fetch: typeof fetch
  export default _fetch;
}
