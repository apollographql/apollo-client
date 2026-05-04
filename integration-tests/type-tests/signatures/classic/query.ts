import { ApolloClient, gql, TypedDocumentNode } from "@apollo/client";
import { expectTypeOf } from "expect-type";
import { test } from "./shared.js";

interface Data {
  foo: string;
}

interface Variables {
  bar?: number;
}

declare const client: ApolloClient;
declare const query: TypedDocumentNode<Data, Variables>;

test("returns narrowed TData in default case", () => {
  const result = client.query({ query });

  expectTypeOf(result).toEqualTypeOf<Promise<ApolloClient.QueryResult<Data>>>();
});

test('returns narrowed TData with errorPolicy: "none"', () => {
  const result = client.query({ query, errorPolicy: "none" });

  expectTypeOf(result).toEqualTypeOf<
    Promise<ApolloClient.QueryResult<Data, "none">>
  >();
});

test('returns narrowed TData with errorPolicy: "all"', () => {
  const result = client.query({ query, errorPolicy: "all" });

  expectTypeOf(result).toEqualTypeOf<
    Promise<ApolloClient.QueryResult<Data, "all">>
  >();
});

test('returns narrowed TData with errorPolicy: "ignore"', () => {
  const result = client.query({ query, errorPolicy: "ignore" });

  expectTypeOf(result).toEqualTypeOf<
    Promise<ApolloClient.QueryResult<Data, "ignore">>
  >();
});
