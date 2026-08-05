import {
  ApolloClient,
  ErrorLike,
  gql,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { expectTypeOf } from "expect-type";

import { test } from "./shared.js";

declare const client: ApolloClient;

test("rejects unknown options", () => {
  interface Data {
    character: string;
  }

  const literalVariables: TypedDocumentNode<Data, { type: "main" }> = gql``;
  const widenedVariables: TypedDocumentNode<Data, { type: string }> = gql``;
  const noVariables: TypedDocumentNode<Data, Record<string, never>> = gql``;

  client.mutate({
    mutation: literalVariables,
    variables: { type: "main" },
    errorPolicy: "all",
    context: { foo: 1 },
    awaitRefetchQueries: true,
    keepRootFields: true,
  });

  client.mutate({
    mutation: literalVariables,
    variables: { type: "main" },
    // @ts-expect-error unknown option
    errorPolcy: "all",
  });

  client.mutate({
    mutation: widenedVariables,
    variables: { type: "main" },
    // @ts-expect-error unknown option
    errorPolcy: "all",
  });

  client.mutate({
    mutation: noVariables,
    // @ts-expect-error unknown option
    errorPolcy: "all",
  });

  client.mutate({
    mutation: literalVariables,
    variables: { type: "main" },
    errorPolicy: "all",
    // @ts-expect-error unknown option
    bogusOption: 1,
  });
});

test("rejects a known option with an invalid value", () => {
  interface Data {
    character: string;
  }

  const mutation: TypedDocumentNode<Data, { id: string }> = gql``;

  client.mutate({
    mutation,
    variables: { id: "1" },
    fetchPolicy: "network-only",
  });
  // @ts-expect-error invalid fetchPolicy
  client.mutate({ mutation, variables: { id: "1" }, fetchPolicy: "bogus" });
  // @ts-expect-error invalid errorPolicy
  client.mutate({ mutation, variables: { id: "1" }, errorPolicy: "bogus" });
});

test("rejects invalid variable values for constant variable types", () => {
  interface Data {
    character: string;
  }

  const mutation: TypedDocumentNode<Data, { type: "main" }> = gql``;

  client.mutate({ mutation, variables: { type: "main" } });
  // @ts-expect-error invalid variable value
  client.mutate({ mutation, variables: { type: "nope" } });
  // @ts-expect-error unknown variable
  client.mutate({ mutation, variables: { type: "main", foo: "bar" } });
});

test("constant variable types do not widen errorPolicy", async () => {
  interface Data {
    character: string;
  }

  {
    const mutation: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const { data, error } = await client.mutate({
      mutation,
      variables: { type: "main" },
    });

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const mutation: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const { data, error } = await client.mutate({
      mutation,
      variables: { type: "main" },
      errorPolicy: "none",
    });

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const mutation: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const { data, error } = await client.mutate({
      mutation,
      variables: { type: "main" },
      errorPolicy: "all",
    });

    expectTypeOf(data).toEqualTypeOf<Data | undefined>();
    expectTypeOf(error).toEqualTypeOf<ErrorLike | undefined>();
  }

  {
    const mutation: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const { data, error } = await client.mutate({
      mutation,
      variables: { type: "main" },
      errorPolicy: "ignore",
    });

    expectTypeOf(data).toEqualTypeOf<Data | undefined>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const mutation: TypedDocumentNode<Data, { episode: 10 }> = gql``;

    const { data, error } = await client.mutate({
      mutation,
      variables: { episode: 10 },
      errorPolicy: "none",
    });

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const mutation: TypedDocumentNode<Data, { main: true }> = gql``;

    const { data, error } = await client.mutate({
      mutation,
      variables: { main: true },
      errorPolicy: "none",
    });

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }
});

test("optimisticResponse does not widen the result", async () => {
  interface Data {
    updateThing: {
      __typename: "Payload";
      inner: { __typename: "Inner"; data: Record<string, unknown> };
    };
  }

  const mutation: TypedDocumentNode<Data, { id: string }> = gql``;

  {
    const { data, error } = await client.mutate({
      mutation,
      variables: { id: "1" },
      optimisticResponse: {
        updateThing: {
          __typename: "Payload",
          inner: { __typename: "Inner", data: { x: 1 } },
        },
      },
    });

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const { data, error } = await client.mutate({
      mutation,
      variables: { id: "1" },
      errorPolicy: "all",
      optimisticResponse: {
        updateThing: {
          __typename: "Payload",
          inner: { __typename: "Inner", data: { x: 1 } },
        },
      },
    });

    expectTypeOf(data).toEqualTypeOf<Data | undefined>();
    expectTypeOf(error).toEqualTypeOf<ErrorLike | undefined>();
  }

  {
    const { data, error } = await client.mutate({
      mutation,
      variables: { id: "1" },
      optimisticResponse: () => ({
        updateThing: {
          __typename: "Payload" as const,
          inner: { __typename: "Inner" as const, data: { x: 1 } },
        },
      }),
    });

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }
});

test("rejects an invalid optimisticResponse", () => {
  interface Data {
    thing: { __typename: "Thing"; name: string };
  }

  const mutation: TypedDocumentNode<Data, { id: string }> = gql``;

  client.mutate({
    mutation,
    variables: { id: "1" },
    optimisticResponse: { thing: { __typename: "Thing", name: "a" } },
  });

  client.mutate({
    mutation,
    variables: { id: "1" },
    // @ts-expect-error invalid __typename
    optimisticResponse: { thing: { __typename: "Nope", name: "a" } },
  });

  client.mutate({
    mutation,
    variables: { id: "1" },
    // @ts-expect-error missing field
    optimisticResponse: { thing: { __typename: "Thing" } },
  });

  client.mutate({
    mutation,
    variables: { id: "1" },
    // @ts-expect-error excess field
    optimisticResponse: { thing: { __typename: "Thing", name: "a", id: 1 } },
  });

  client.mutate({
    mutation,
    variables: { id: "1" },
    // @ts-expect-error not an object
    optimisticResponse: 1,
  });
});

test("passes through generic variables", () => {
  function wrapper<TData, TVariables extends OperationVariables>(
    mutation: TypedDocumentNode<TData, TVariables>,
    variables: TVariables
  ) {
    return client.mutate({ mutation, variables });
  }

  const mutation: TypedDocumentNode<{ character: string }, { id: string }> =
    gql``;

  wrapper(mutation, { id: "1" });
});
