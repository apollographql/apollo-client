import { useMutation } from "@apollo/client/react";
import { ApolloClient, gql, OperationVariables } from "@apollo/client";
import { expectTypeOf } from "expect-type";

import { test } from "./shared.js";
import type { StreamingOverride } from "./shared.js";

test("NoInfer prevents adding arbitrary additional variables", () => {
  type Data = { foo: string };
  type Variables = { bar: number };
  const mutation = gql``;

  useMutation<Data, Variables>(mutation, {
    variables: {
      bar: 4,
      // @ts-expect-error
      nonExistingVariable: "string",
    },
  });
});

test("uses TData type when using explicit generics", () => {
  interface Mutation {
    updateUser: {
      __typename: "User";
      id: string;
      age: number;
    };
  }

  interface Variables {
    id: string;
  }

  const mutation = gql``;

  const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
    variables: { id: "1" },
    optimisticResponse: {
      updateUser: { __typename: "User", id: "1", age: 30 },
    },
    updateQueries: {
      TestQuery: (_, { mutationResult }) => {
        expectTypeOf(mutationResult.data).toEqualTypeOf<
          Mutation | StreamingOverride<Mutation>
        >();
        if (mutationResult.dataState === "streaming") {
          expectTypeOf(mutationResult.data).toEqualTypeOf<
            StreamingOverride<Mutation>
          >();
        }
        if (mutationResult.dataState === "complete") {
          expectTypeOf(mutationResult.data).toEqualTypeOf<Mutation>();
        }

        return {};
      },
    },
    refetchQueries(result) {
      expectTypeOf(result.data).toEqualTypeOf<
        Mutation | StreamingOverride<Mutation>
      >();

      return "active";
    },
    onCompleted(data) {
      expectTypeOf(data).toEqualTypeOf<Mutation>();
    },
    update(_, result) {
      expectTypeOf(result.data).toEqualTypeOf<Mutation | null | undefined>();
    },
  });

  expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
  expectTypeOf(
    // @ts-expect-error TConfiguredVariables not provided
    mutate()
  ).toEqualTypeOf<Promise<ApolloClient.MutateResult<Mutation>>>();
});

test("uses proper masked/unmasked type", async () => {
  type UserFieldsFragment = {
    __typename: "User";
    age: number;
  } & { " $fragmentName": "UserFieldsFragment" };

  type Mutation = {
    updateUser: {
      __typename: "User";
      id: string;
    } & { " $fragmentRefs": { UserFieldsFragment: UserFieldsFragment } };
  };

  type UnmaskedMutation = {
    updateUser: {
      __typename: "User";
      id: string;
      age: number;
    };
  };

  interface Variables {
    id: string;
  }

  const mutation = gql``;

  const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
    optimisticResponse: {
      updateUser: { __typename: "User", id: "1", age: 30 },
    },
    updateQueries: {
      TestQuery: (_, { mutationResult }) => {
        expectTypeOf(mutationResult.data).toEqualTypeOf<
          UnmaskedMutation | StreamingOverride<UnmaskedMutation>
        >();

        if (mutationResult.dataState === "streaming") {
          expectTypeOf(mutationResult.data).toEqualTypeOf<
            StreamingOverride<UnmaskedMutation>
          >();
        }
        if (mutationResult.dataState === "complete") {
          expectTypeOf(mutationResult.data).toEqualTypeOf<UnmaskedMutation>();
        }

        return {};
      },
    },
    refetchQueries(result) {
      expectTypeOf(result.data).toEqualTypeOf<
        UnmaskedMutation | StreamingOverride<UnmaskedMutation>
      >();

      return "active";
    },
    onCompleted(data) {
      expectTypeOf(data).toEqualTypeOf<Mutation>();
    },
    update(_, result) {
      expectTypeOf(result.data).toEqualTypeOf<
        UnmaskedMutation | null | undefined
      >();
    },
  });

  expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
  expectTypeOf(mutate({ variables: { id: "1" } })).toEqualTypeOf<
    Promise<ApolloClient.MutateResult<Mutation>>
  >();
});

test("updates mutate result using explicit error policy", () => {
  interface Mutation {
    updateUser: {
      __typename: "User";
      id: string;
      age: number;
    };
  }

  interface Variables {
    id: string;
  }

  const mutation = gql``;

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      variables: { id: "1" },
      errorPolicy: "none",
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(
      // @ts-expect-error TConfiguredVariables not provided
      mutate()
    ).toEqualTypeOf<Promise<ApolloClient.MutateResult<Mutation>>>();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      variables: { id: "1" },
      errorPolicy: "none",
      optimisticResponse: {
        updateUser: { __typename: "User", id: "1", age: 30 },
      },
      updateQueries: {
        TestQuery: (_, { mutationResult }) => {
          expectTypeOf(mutationResult.data).toEqualTypeOf<
            Mutation | StreamingOverride<Mutation>
          >();
          if (mutationResult.dataState === "streaming") {
            expectTypeOf(mutationResult.data).toEqualTypeOf<
              StreamingOverride<Mutation>
            >();
          }
          if (mutationResult.dataState === "complete") {
            expectTypeOf(mutationResult.data).toEqualTypeOf<Mutation>();
          }

          return {};
        },
      },
      refetchQueries(result) {
        expectTypeOf(result.data).toEqualTypeOf<
          Mutation | StreamingOverride<Mutation>
        >();

        return "active";
      },
      onCompleted(data) {
        expectTypeOf(data).toEqualTypeOf<Mutation>();
      },
      update(_, result) {
        expectTypeOf(result.data).toEqualTypeOf<Mutation | null | undefined>();
      },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(
      // @ts-expect-error TConfiguredVariables not provided
      mutate()
    ).toEqualTypeOf<Promise<ApolloClient.MutateResult<Mutation>>>();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      variables: { id: "1" },
      errorPolicy: "all",
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(
      // @ts-expect-error TConfiguredVariables not provided
      mutate()
    ).toEqualTypeOf<Promise<ApolloClient.MutateResult<Mutation>>>();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      variables: { id: "1" },
      errorPolicy: "all",
      optimisticResponse: {
        updateUser: { __typename: "User", id: "1", age: 30 },
      },
      updateQueries: {
        TestQuery: (_, { mutationResult }) => {
          expectTypeOf(mutationResult.data).toEqualTypeOf<
            Mutation | StreamingOverride<Mutation>
          >();
          if (mutationResult.dataState === "streaming") {
            expectTypeOf(mutationResult.data).toEqualTypeOf<
              StreamingOverride<Mutation>
            >();
          }
          if (mutationResult.dataState === "complete") {
            expectTypeOf(mutationResult.data).toEqualTypeOf<Mutation>();
          }

          return {};
        },
      },
      refetchQueries(result) {
        expectTypeOf(result.data).toEqualTypeOf<
          Mutation | StreamingOverride<Mutation>
        >();

        return "active";
      },
      onCompleted(data) {
        expectTypeOf(data).toEqualTypeOf<Mutation>();
      },
      update(_, result) {
        expectTypeOf(result.data).toEqualTypeOf<Mutation | null | undefined>();
      },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(
      // @ts-expect-error TConfiguredVariables not provided
      mutate()
    ).toEqualTypeOf<Promise<ApolloClient.MutateResult<Mutation>>>();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      variables: { id: "1" },
      errorPolicy: "ignore",
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(
      // @ts-expect-error TConfiguredVariables not provided
      mutate()
    ).toEqualTypeOf<Promise<ApolloClient.MutateResult<Mutation>>>();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      variables: { id: "1" },
      errorPolicy: "ignore",
      optimisticResponse: {
        updateUser: { __typename: "User", id: "1", age: 30 },
      },
      updateQueries: {
        TestQuery: (_, { mutationResult }) => {
          expectTypeOf(mutationResult.data).toEqualTypeOf<
            Mutation | StreamingOverride<Mutation>
          >();
          if (mutationResult.dataState === "streaming") {
            expectTypeOf(mutationResult.data).toEqualTypeOf<
              StreamingOverride<Mutation>
            >();
          }
          if (mutationResult.dataState === "complete") {
            expectTypeOf(mutationResult.data).toEqualTypeOf<Mutation>();
          }

          return {};
        },
      },
      refetchQueries(result) {
        expectTypeOf(result.data).toEqualTypeOf<
          Mutation | StreamingOverride<Mutation>
        >();

        return "active";
      },
      onCompleted(data) {
        expectTypeOf(data).toEqualTypeOf<Mutation>();
      },
      update(_, result) {
        expectTypeOf(result.data).toEqualTypeOf<Mutation | null | undefined>();
      },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(
      // @ts-expect-error TConfiguredVariables not provided
      mutate()
    ).toEqualTypeOf<Promise<ApolloClient.MutateResult<Mutation>>>();
  }
});

test("works with optional variables", () => {
  interface Mutation {
    increment: number;
  }

  interface Variables {
    by?: number;
  }

  const mutation = gql``;

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation);

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation>>
    >();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      variables: { by: 2 },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation>>
    >();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      errorPolicy: "none",
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation>>
    >();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      errorPolicy: "none",
      variables: { by: 2 },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation>>
    >();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      errorPolicy: "all",
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "all">>
    >();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      errorPolicy: "all",
      variables: { by: 2 },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "all">>
    >();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      errorPolicy: "ignore",
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation>>
    >();
  }

  {
    const [mutate, { data }] = useMutation<Mutation, Variables>(mutation, {
      errorPolicy: "ignore",
      variables: { by: 2 },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation>>
    >();
  }
});

test("variables are optional and can be anything with an DocumentNode", () => {
  type Data = { greeting: string };
  const mutation = gql``;

  {
    const [mutate] = useMutation<Data>(mutation);
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation<Data>(mutation, {});
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation<Data>(mutation, { variables: {} });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation<Data>(mutation, {
      variables: { foo: "bar" },
    });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation<Data>(mutation, {
      variables: { bar: "baz" },
    });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
});

test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
  type Data = { greeting: string };
  const mutation = gql``;

  {
    const [mutate] = useMutation<Data, OperationVariables>(mutation);
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation<Data, OperationVariables>(mutation, {});
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation<Data, OperationVariables>(mutation, {
      variables: {},
    });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation<Data, OperationVariables>(mutation, {
      variables: { foo: "bar" },
    });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation<Data, OperationVariables>(mutation, {
      variables: { bar: "baz" },
    });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
});

test("variables are optional when TVariables are empty", () => {
  type Data = { greeting: string };
  type Variables = Record<string, never>;
  const mutation = gql``;

  {
    const [mutate] = useMutation<Data, Variables>(mutation);
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {});
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, { variables: {} });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
});

test("is invalid when TVariables is `never`", () => {
  type Data = { greeting: string };
  const mutation = gql``;

  {
    const [mutate] = useMutation<Data, never>(mutation);
    // @ts-expect-error
    mutate();
    // @ts-expect-error
    mutate({});
    mutate({
      // @ts-expect-error
      variables: {},
    });
    mutate({
      // @ts-expect-error
      variables: undefined,
    });
    mutate({
      // @ts-expect-error
      variables: {
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, never>(mutation, {});
    // @ts-expect-error
    mutate();
    // @ts-expect-error
    mutate({});
    mutate({
      // @ts-expect-error
      variables: {},
    });
    mutate({
      // @ts-expect-error
      variables: undefined,
    });
    mutate({
      // @ts-expect-error
      variables: {
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, never>(mutation, {
      // @ts-expect-error
      variables: {},
    });
    // @ts-expect-error
    mutate();
    // @ts-expect-error
    mutate({});
    mutate({
      // @ts-expect-error
      variables: {},
    });
    mutate({
      // @ts-expect-error
      variables: undefined,
    });
    mutate({
      // @ts-expect-error
      variables: {
        foo: "bar",
      },
    });
  }
  {
    // @ts-expect-error
    const [mutate] = useMutation<Data, never>(mutation, {
      variables: undefined,
    });
    // @ts-expect-error
    mutate();
    // @ts-expect-error
    mutate({});
    mutate({
      // @ts-expect-error
      variables: {},
    });
    mutate({
      // @ts-expect-error
      variables: undefined,
    });
    mutate({
      // @ts-expect-error
      variables: {
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, never>(mutation, {
      // @ts-expect-error
      variables: {
        foo: "bar",
      },
    });
    // @ts-expect-error
    mutate();
    // @ts-expect-error
    mutate({});
    mutate({
      // @ts-expect-error
      variables: {},
    });
    mutate({
      // @ts-expect-error
      variables: undefined,
    });
    mutate({
      // @ts-expect-error
      variables: {
        foo: "bar",
      },
    });
  }
});

test("optional variables are optional", () => {
  type Data = { posts: string[] };
  type Variables = { limit?: number };
  const mutation = gql``;

  {
    const [mutate] = useMutation<Data, Variables>(mutation);
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { limit: 10 } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        limit: 10,
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {});
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { limit: 10 } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        limit: 10,
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, { variables: {} });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { limit: 10 } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        limit: 10,
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: { limit: 10 },
    });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { limit: 10 } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        limit: 10,
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { limit: 10 } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        limit: 10,
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: {
        limit: 10,
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { limit: 10 } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        limit: 10,
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
});

test("enforces required variables when TVariables includes required variables", () => {
  type Data = { character: string };
  type Variables = { id: string };
  const mutation = gql``;

  {
    const [mutate] = useMutation<Data, Variables>(mutation);
    // @ts-expect-error missing variables
    mutate();
    // @ts-expect-error missing variables
    mutate({});
    mutate({
      // @ts-expect-error missing variables
      variables: {},
    });
    mutate({ variables: { id: "1" } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {});
    // @ts-expect-error missing variables
    mutate();
    // @ts-expect-error missing variables
    mutate({});
    mutate({
      // @ts-expect-error missing variables
      variables: {},
    });
    mutate({ variables: { id: "1" } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, { variables: {} });
    // @ts-expect-error missing variables
    mutate();
    // @ts-expect-error missing variables
    mutate({});
    mutate({
      // @ts-expect-error missing variables
      variables: {},
    });
    mutate({ variables: { id: "1" } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: { id: "1" },
    });
    // @ts-expect-error TConfiguredVariables not provided
    mutate();
    // @ts-expect-error TConfiguredVariables not provided
    mutate({});
    // @ts-expect-error TConfiguredVariables not provided
    mutate({ variables: {} });
    mutate({ variables: { id: "1" } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    // @ts-expect-error TConfiguredVariables not provided
    mutate();
    // @ts-expect-error TConfiguredVariables not provided
    mutate({});
    // @ts-expect-error TConfiguredVariables not provided
    mutate({ variables: {} });
    mutate({ variables: { id: "1" } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    // @ts-expect-error TConfiguredVariables not provided
    mutate();
    // @ts-expect-error TConfiguredVariables not provided
    mutate({});
    // @ts-expect-error TConfiguredVariables not provided
    mutate({ variables: {} });
    mutate({ variables: { id: "1" } });
    mutate({
      variables: {
        // @ts-expect-error
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error
        foo: "bar",
      },
    });
  }
});

test("requires variables with mixed TVariables", () => {
  type Data = { character: string };
  type Variables = { id: string; language?: string };
  const mutation = gql``;

  {
    const [mutate] = useMutation<Data, Variables>(mutation);
    // @ts-expect-error missing variables
    mutate();
    // @ts-expect-error missing variables
    mutate({});
    mutate({
      // @ts-expect-error missing variables
      variables: {},
    });
    mutate({ variables: { id: "1" } });
    mutate({ variables: { id: "1", language: "en" } });
    mutate({
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {});
    // @ts-expect-error missing variables
    mutate();
    // @ts-expect-error missing variables
    mutate({});
    mutate({
      // @ts-expect-error missing variables
      variables: {},
    });
    mutate({ variables: { id: "1" } });
    mutate({ variables: { id: "1", language: "en" } });
    mutate({
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, { variables: {} });
    // @ts-expect-error missing variables
    mutate();
    // @ts-expect-error missing variables
    mutate({});
    mutate({
      // @ts-expect-error missing variables
      variables: {},
    });
    mutate({ variables: { id: "1" } });
    mutate({ variables: { id: "1", language: "en" } });
    mutate({
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: { language: "en" },
    });
    // @ts-expect-error missing variables
    mutate();
    // @ts-expect-error missing variables
    mutate({});
    mutate({
      // @ts-expect-error missing variables
      variables: {},
    });
    mutate({ variables: { id: "1" } });
    mutate({ variables: { id: "1", language: "en" } });
    mutate({
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: { id: "1" },
    });
    // @ts-expect-error TConfiguredVariables not provided
    mutate();
    // @ts-expect-error TConfiguredVariables not provided
    mutate({});
    // @ts-expect-error TConfiguredVariables not provided
    mutate({ variables: {} });
    mutate({ variables: { id: "1" } });
    mutate({ variables: { id: "1", language: "en" } });
    mutate({
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: { id: "1", language: "en" },
    });
    // @ts-expect-error TConfiguredVariables not provided
    mutate();
    // @ts-expect-error TConfiguredVariables not provided
    mutate({});
    // @ts-expect-error TConfiguredVariables not provided
    mutate({ variables: {} });
    mutate({ variables: { id: "1" } });
    mutate({ variables: { id: "1", language: "en" } });
    mutate({
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    // @ts-expect-error TConfiguredVariables not provided
    mutate();
    // @ts-expect-error TConfiguredVariables not provided
    mutate({});
    // @ts-expect-error TConfiguredVariables not provided
    mutate({ variables: {} });
    mutate({ variables: { id: "1" } });
    mutate({ variables: { id: "1", language: "en" } });
    mutate({
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    // @ts-expect-error TConfiguredVariables not provided
    mutate();
    // @ts-expect-error TConfiguredVariables not provided
    mutate({});
    // @ts-expect-error TConfiguredVariables not provided
    mutate({ variables: {} });
    mutate({ variables: { id: "1" } });
    mutate({ variables: { id: "1", language: "en" } });
    mutate({
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  }
  {
    const [mutate] = useMutation<Data, Variables>(mutation, {
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    // @ts-expect-error TConfiguredVariables not provided
    mutate();
    // @ts-expect-error TConfiguredVariables not provided
    mutate({});
    // @ts-expect-error TConfiguredVariables not provided
    mutate({ variables: {} });
    mutate({ variables: { id: "1" } });
    mutate({ variables: { id: "1", language: "en" } });
    mutate({
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    mutate({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  }
});
