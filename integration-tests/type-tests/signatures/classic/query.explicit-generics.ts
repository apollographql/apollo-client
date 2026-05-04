import { ApolloClient, DocumentNode } from "@apollo/client";
import { expectTypeOf } from "expect-type";
import { test } from "./shared.js";

interface Data {
  foo: string;
}

interface Variables {
  bar?: number;
}

declare const client: ApolloClient;
declare const query: DocumentNode;

test("returns narrowed TData in default case", () => {
  const result = client.query<Data, Variables>({ query });

  expectTypeOf(result).toEqualTypeOf<Promise<ApolloClient.QueryResult<Data>>>();
});

test('returns narrowed TData with errorPolicy: "none"', () => {
  {
    const result = client.query<Data, Variables>({
      query: query,
      errorPolicy: "none",
    });

    // "none" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data>>
    >();
  }

  {
    const result = client.query<Data, Variables, "none">({
      query: query,
      errorPolicy: "none",
    });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data, "none">>
    >();
  }
});

test('returns narrowed TData with errorPolicy: "all"', () => {
  {
    const result = client.query<Data, Variables>({
      query,
      errorPolicy: "all",
    });

    // "all" not specified in generic argument
    expectTypeOf(result).branded.toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data>>
    >();
  }

  {
    const result = client.query<Data, Variables, "all">({
      query,
      errorPolicy: "all",
    });

    expectTypeOf(result).branded.toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data, "all">>
    >();
  }
});

test('returns narrowed TData with errorPolicy: "ignore"', () => {
  {
    const result = client.query<Data, Variables>({
      query,
      errorPolicy: "ignore",
    });

    // "ignore" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data>>
    >();
  }

  {
    const result = client.query<Data, Variables, "ignore">({
      query,
      errorPolicy: "ignore",
    });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data, "ignore">>
    >();
  }
});
