import { expectTypeOf } from "expect-type";

import type { ErrorLike, TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";

describe.skip("type tests", () => {
  test("returns TData by default", async () => {
    interface Query {
      greeting: string;
    }
    type Variables = Record<string, never>;
    const query: TypedDocumentNode<Query, Variables> = gql`
      query {
        greeting
      }
    `;

    const client = createClient();

    expectTypeOf(await client.query({ query })).toEqualTypeOf<{
      data: Query;
      error?: never;
    }>();
  });

  test("returns TData with errorPolicy: none", async () => {
    interface Query {
      greeting: string;
    }
    type Variables = Record<string, never>;
    const query: TypedDocumentNode<Query, Variables> = gql`
      query {
        greeting
      }
    `;

    const client = createClient();

    expectTypeOf(
      await client.query({ query, errorPolicy: "none" })
    ).toEqualTypeOf<{ data: Query; error?: never }>();
  });

  test("returns TData | undefined with errorPolicy: all", async () => {
    interface Query {
      greeting: string;
    }
    type Variables = Record<string, never>;
    const query: TypedDocumentNode<Query, Variables> = gql`
      query {
        greeting
      }
    `;

    const client = createClient();

    expectTypeOf(
      await client.query({ query, errorPolicy: "all" })
    ).toEqualTypeOf<{ data: Query | undefined; error?: ErrorLike }>();
  });

  test("returns TData | undefined with errorPolicy: ignore", async () => {
    interface Query {
      greeting: string;
    }
    type Variables = Record<string, never>;
    const query: TypedDocumentNode<Query, Variables> = gql`
      query {
        greeting
      }
    `;

    const client = createClient();

    expectTypeOf(
      await client.query({ query, errorPolicy: "ignore" })
    ).toEqualTypeOf<{
      data: Query | undefined;
      error?: never;
    }>();
  });
});

function createClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });
}
