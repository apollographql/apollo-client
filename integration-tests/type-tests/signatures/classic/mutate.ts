import { ApolloClient, TypedDocumentNode } from "@apollo/client";
import { expectTypeOf } from "expect-type";
import { test } from "./shared.js";

interface Data {
  foo: string;
}

interface Variables {
  bar?: number;
}

declare const client: ApolloClient;
declare const mutation: TypedDocumentNode<Data, Variables>;

test("returns narrowed TData in default case", () => {
  const result = client.mutate({ mutation });

  expectTypeOf(result).toEqualTypeOf<
    Promise<ApolloClient.MutateResult<Data>>
  >();
});

test('returns narrowed TData with errorPolicy: "none"', () => {
  const result = client.mutate({ mutation, errorPolicy: "none" });

  expectTypeOf(result).toEqualTypeOf<
    Promise<ApolloClient.MutateResult<Data, "none">>
  >();
});

test('returns narrowed TData with errorPolicy: "all"', () => {
  const result = client.mutate({ mutation, errorPolicy: "all" });

  expectTypeOf(result).toEqualTypeOf<
    Promise<ApolloClient.MutateResult<Data, "all">>
  >();
});

test('returns narrowed TData with errorPolicy: "ignore"', () => {
  const result = client.mutate({ mutation, errorPolicy: "ignore" });

  expectTypeOf(result).toEqualTypeOf<
    Promise<ApolloClient.MutateResult<Data, "ignore">>
  >();
});
