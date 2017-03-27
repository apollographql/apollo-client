/*

  GRAPHQL

*/
declare module 'graphql/language/parser' {
  import { Source, ParseOptions, DocumentNode } from 'graphql';
  // XXX figure out how to directly export this method
  function parse(
      source: Source | string,
      options?: ParseOptions
  ): DocumentNode;
}

declare module 'graphql/language/printer' {
  function print(ast: any): string;
}

