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
  {
    const result = client.query<Data>({ query });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data>>
    >();
  }

  {
    const result = client.query<Data, Variables>({ query });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data>>
    >();
  }
});

test('returns narrowed TData with errorPolicy: "none"', () => {
  {
    const result = client.query<Data>({ query, errorPolicy: "none" });

    // "none" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data>>
    >();
  }

  {
    const result = client.query<Data, Variables>({
      query,
      errorPolicy: "none",
    });

    // "none" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data>>
    >();
  }

  {
    const result = client.query<Data, Variables, "none">({
      query,
      errorPolicy: "none",
    });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data, "none">>
    >();
  }

  client.query<Data, Variables, "none">(
    // @ts-expect-error missing "errorPolicy" option
    { query }
  );

  client.query<Data, Variables, "none">({
    query,
    // @ts-expect-error "all" not assignable to "none"
    errorPolicy: "all",
  });
});

test('returns narrowed TData with errorPolicy: "all"', () => {
  {
    const result = client.query<Data>({ query, errorPolicy: "all" });

    // "all" not specified in generic argument
    expectTypeOf(result).branded.toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data>>
    >();
  }

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

  client.query<Data, Variables, "all">(
    // @ts-expect-error missing "errorPolicy" option
    { query }
  );

  client.query<Data, Variables, "all">({
    query,
    // @ts-expect-error "none" not assignable to "all"
    errorPolicy: "none",
  });
});

test('returns narrowed TData with errorPolicy: "ignore"', () => {
  {
    const result = client.query<Data>({ query, errorPolicy: "ignore" });

    // "ignore" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.QueryResult<Data>>
    >();
  }

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

  client.query<Data, Variables, "ignore">(
    // @ts-expect-error missing "errorPolicy" option
    { query }
  );

  client.query<Data, Variables, "ignore">({
    query,
    // @ts-expect-error "none" not assignable to "ignore"
    errorPolicy: "none",
  });
});

test("does not allow arbitrary errorPolicy", () => {
  // @ts-expect-error "foo" not assignable to errorPolicy
  client.query<Data, Variables, "foo">({ query });
  client.query<Data, Variables>({
    query,
    // @ts-expect-error "foo" not assignable to ErrorPolicy
    errorPolicy: "foo",
  });
  // @ts-expect-error "foo" not assignable to ErrorPolicy
  client.query<Data, Variables, "foo">({
    query,
    errorPolicy: "foo",
  });
});
