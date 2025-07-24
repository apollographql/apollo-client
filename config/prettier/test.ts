import * as prettier from "prettier";
const code = `


/**
 * A hook for executing queries in an Apollo application.
 *
 * To run a query within a React component, call \`useQuery\` and pass it a GraphQL query document.
 *
 * When your component renders, \`useQuery\` returns an object from Apollo Client that contains
 *
 * > Refer to the [Queries](https://www.apollographql.com/docs/react/data/queries) section for a more in-depth overview of \`useQuery\`.
 *
 * @example
 * \`\`\`jsx
 * import { gql } from '@apollo/client';
 * import { useQuery } from '@apollo/client/react';
 *
 * const GET_GREETING = gql\`
 *   query GetGreeting($language: String!) {
 *     greeting(language: $language) {
 *       message
 *     }
 *   }
 * \`;
 *
 * function Hello() {
 *   const { loading, error, data } = useQuery(GET_GREETING, {
 *                 variables: { language: 'english' },
 *   });
 *   if (loading) return <p>Loading ...</p>;
 *   return <h1>Hello {data.greeting.message}!</h1>;
 * }
 * \`\`\`
 * @param query - A GraphQL query document parsed into an AST by \`gql\`.
 * @param options - Options to control how the query is executed.
 * @returns Query result object
 */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: true;
  }
): useQuery.Result<
  TData,
  TVariables,
  "empty" | "complete" | "streaming" | "partial"
>;

/** {@inheritDoc @apollo/client!useQuery:function(1)} */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: boolean;
  }
): useQuery.Result<
  TData,
  TVariables,
  "empty" | "complete" | "streaming" | "partial"
>;

/** {@inheritDoc @apollo/client!useQuery:function(1)} */
export function useQuery<
  TData = unknown,
TVariables extends OperationVariables = OperationVariables,
>(
query: DocumentNode | TypedDocumentNode<TData, TVariables>,
...[options]: {} extends TVariables ?
 [options?: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>]
: [options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>]
): useQuery.Result<TData, TVariables, "empty" | "complete" | "streaming">;

`
  .split("\n")
  .map((line) => line.trim())
  .join("\n");
await prettier.format(``, {
  parser: "jsdoc",
  plugins: ["./format-jsdoc.js"],
});

const result = await prettier.format(code, {
  parser: "typescript-with-jsdoc",
  plugins: ["./format-jsdoc.js"],
});

console.log(result);
