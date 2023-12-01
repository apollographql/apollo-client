import { createQueryPreloader } from "../createQueryPreloader";
import {
  ApolloClient,
  InMemoryCache,
  TypedDocumentNode,
  gql,
} from "../../../core";
import { MockLink } from "../../../testing";
import { expectTypeOf } from "expect-type";
import { QueryReference } from "../../cache/QueryReference";

describe.skip("type tests", () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
  });
  const preloadQuery = createQueryPreloader(client);

  test("returns unknown when TData cannot be inferred", () => {
    const query = gql``;

    const [queryRef] = preloadQuery({ query });

    expectTypeOf(queryRef).toEqualTypeOf<QueryReference<unknown>>();
  });

  test("variables are optional and can be anything with untyped DocumentNode", () => {
    const query = gql``;

    preloadQuery({ query });
    preloadQuery({ query, variables: {} });
    preloadQuery({ query, variables: { foo: "bar" } });
    preloadQuery({ query, variables: { foo: "bar", bar: 2 } });
  });

  test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
    const query: TypedDocumentNode<{ greeting: string }> = gql``;

    preloadQuery({ query });
    preloadQuery({ query, variables: {} });
    preloadQuery({ query, variables: { foo: "bar" } });
    preloadQuery({ query, variables: { foo: "bar", bar: 2 } });
  });

  test("variables are optional when TVariables are empty", () => {
    const query: TypedDocumentNode<
      { greeting: string },
      Record<string, never>
    > = gql``;

    preloadQuery({ query });
    preloadQuery({ query, variables: {} });
    // @ts-expect-error unknown variables
    preloadQuery({ query, variables: { foo: "bar" } });
  });

  test("does not allow variables when TVariables is `never`", () => {
    const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

    preloadQuery({ query });
    // @ts-expect-error no variables option allowed
    preloadQuery({ query, variables: {} });
    // @ts-expect-error no variables option allowed
    preloadQuery({ query, variables: { foo: "bar" } });
  });

  test("optional variables are optional", () => {
    const query: TypedDocumentNode<
      { posts: string[] },
      { limit?: number }
    > = gql``;

    preloadQuery({ query });
    preloadQuery({ query, variables: {} });
    preloadQuery({ query, variables: { limit: 10 } });
    preloadQuery({
      query,
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery({
      query,
      variables: {
        limit: 10,
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("enforces required variables", () => {
    const query: TypedDocumentNode<
      { character: string },
      { id: string }
    > = gql``;

    // @ts-expect-error missing variables option
    preloadQuery({ query });
    // @ts-expect-error empty variables
    preloadQuery({ query, variables: {} });
    preloadQuery({ query, variables: { id: "1" } });
    preloadQuery({
      query,
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery({
      query,
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("requires variables with mixed TVariables", () => {
    const query: TypedDocumentNode<
      { character: string },
      { id: string; language?: string }
    > = gql``;

    // @ts-expect-error missing variables argument
    preloadQuery({ query });
    // @ts-expect-error missing variables argument
    preloadQuery({ query, variables: {} });
    preloadQuery({ query, variables: { id: "1" } });
    // @ts-expect-error missing required variable
    preloadQuery({ query, variables: { language: "en" } });
    preloadQuery({ query, variables: { id: "1", language: "en" } });
    preloadQuery({
      query,
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery({
      query,
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery({
      query,
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });
});
