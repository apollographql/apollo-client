import { useMutation } from "@apollo/client/react";
import { ApolloClient, gql, TypedDocumentNode } from "@apollo/client";
import { expectTypeOf } from "expect-type";

import { test } from "./shared.js";
import type { StreamingOverride } from "./shared.js";

test("NoInfer prevents adding arbitrary additional variables", () => {
  const typedNode = {} as TypedDocumentNode<{ foo: string }, { bar: number }>;
  useMutation(typedNode, {
    variables: {
      bar: 4,
      // @ts-expect-error
      nonExistingVariable: "string",
    },
  });
});

test("uses any as masked and unmasked type when using plain DocumentNode", () => {
  const mutation = gql`
    mutation ($id: ID!) {
      updateUser(id: $id) {
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const [mutate, { data }] = useMutation(mutation, {
    optimisticResponse: { foo: "foo" },
    updateQueries: {
      TestQuery: (_, { mutationResult }) => {
        expectTypeOf(mutationResult.data).toEqualTypeOf<unknown>();

        return {};
      },
    },
    refetchQueries(result) {
      expectTypeOf(result.data).toEqualTypeOf<unknown>();

      return "active";
    },
    onCompleted(data) {
      expectTypeOf(data).toEqualTypeOf<unknown>();
    },
    update(_, result) {
      expectTypeOf(result.data).toEqualTypeOf<unknown>();
    },
  });

  expectTypeOf(data).toEqualTypeOf<unknown>();
  expectTypeOf(mutate()).toEqualTypeOf<
    Promise<ApolloClient.MutateResult<unknown, "none">>
  >();
});

test("uses TData type when using plain TypedDocumentNode", () => {
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

  const mutation: TypedDocumentNode<Mutation, Variables> = gql`
    mutation ($id: ID!) {
      updateUser(id: $id) {
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const [mutate, { data }] = useMutation(mutation, {
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
  expectTypeOf(mutate()).toEqualTypeOf<
    Promise<ApolloClient.MutateResult<Mutation, "none">>
  >();
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

  const mutation: TypedDocumentNode<Mutation, Variables> = gql`
      mutation ($id: ID!) {
        updateUser(id: $id) {
          id
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

  const [mutate, { data }] = useMutation(mutation, {
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
    Promise<ApolloClient.MutateResult<Mutation, "none">>
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

  const mutation: TypedDocumentNode<Mutation, Variables> = gql`
    mutation ($id: ID!) {
      updateUser(id: $id) {
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  {
    const [mutate, { data }] = useMutation(mutation, {
      variables: { id: "1" },
      errorPolicy: "none",
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "none">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, {
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
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "none">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, {
      variables: { id: "1" },
      errorPolicy: "all",
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "all">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, {
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
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "all">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, {
      variables: { id: "1" },
      errorPolicy: "ignore",
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "ignore">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, {
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
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "ignore">>
    >();
  }
});

test("works with optional variables", () => {
  interface Mutation {
    increment: number;
  }

  interface Variables {
    by?: number;
  }

  const mutation: TypedDocumentNode<Mutation, Variables> = gql`
    mutation ($id: ID!) {
      increment(by: $id) {
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  {
    const [mutate, { data }] = useMutation(mutation);

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "none">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, { variables: { by: 2 } });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "none">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, { errorPolicy: "none" });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "none">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, {
      errorPolicy: "none",
      variables: { by: 2 },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "none">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, { errorPolicy: "all" });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "all">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, {
      errorPolicy: "all",
      variables: { by: 2 },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "all">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, { errorPolicy: "ignore" });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "ignore">>
    >();
  }

  {
    const [mutate, { data }] = useMutation(mutation, {
      errorPolicy: "ignore",
      variables: { by: 2 },
    });

    expectTypeOf(data).toEqualTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Mutation, "ignore">>
    >();
  }
});

test("variables are optional and can be anything with an DocumentNode", () => {
  const mutation = gql``;

  {
    const [mutate] = useMutation(mutation);
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation(mutation, {});
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation(mutation, { variables: {} });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation(mutation, { variables: { foo: "bar" } });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation(mutation, { variables: { bar: "baz" } });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
});

test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
  const query: TypedDocumentNode<{ greeting: string }> = gql``;

  {
    const [mutate] = useMutation(query);
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation(query, {});
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation(query, { variables: {} });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation(query, { variables: { foo: "bar" } });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
  {
    const [mutate] = useMutation(query, { variables: { bar: "baz" } });
    mutate();
    mutate({});
    mutate({ variables: {} });
    mutate({ variables: { foo: "bar" } });
    mutate({ variables: { bar: "baz" } });
  }
});

test("variables are optional when TVariables are empty", () => {
  const mutation: TypedDocumentNode<
    { greeting: string },
    Record<string, never>
  > = gql``;

  {
    const [mutate] = useMutation(mutation);
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
    const [mutate] = useMutation(mutation, {});
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
    const [mutate] = useMutation(mutation, { variables: {} });
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
    const [mutate] = useMutation(mutation, {
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
  const mutation: TypedDocumentNode<{ greeting: string }, never> = gql``;

  {
    const [mutate] = useMutation(mutation);
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
    const [mutate] = useMutation(mutation, {});
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
    const [mutate] = useMutation(mutation, {
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
    const [mutate] = useMutation(mutation, { variables: undefined });
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
    const [mutate] = useMutation(mutation, {
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
  const mutation: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
    gql``;

  {
    const [mutate] = useMutation(mutation);
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
    const [mutate] = useMutation(mutation, {});
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
    const [mutate] = useMutation(mutation, { variables: {} });
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
    const [mutate] = useMutation(mutation, { variables: { limit: 10 } });
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
    const [mutate] = useMutation(mutation, {
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
    const [mutate] = useMutation(mutation, {
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
  const mutation: TypedDocumentNode<{ character: string }, { id: string }> =
    gql``;

  {
    const [mutate] = useMutation(mutation);
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
    const [mutate] = useMutation(mutation, {});
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
    const [mutate] = useMutation(mutation, { variables: {} });
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
    const [mutate] = useMutation(mutation, { variables: { id: "1" } });
    mutate();
    mutate({});
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
    // The `mutate` function does not give us TS errors for missing required
    // variables due to the mismatch in variables passed to `useMutation`, but
    // we are ok with this tradeoff since fixing the invalid variable to
    // `useMutation` will update the `mutate` function correctly.
    const [mutate] = useMutation(mutation, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    mutate();
    mutate({});
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
    const [mutate] = useMutation(mutation, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    mutate();
    mutate({});
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
  const mutation: TypedDocumentNode<
    { character: string },
    { id: string; language?: string }
  > = gql``;

  {
    const [mutate] = useMutation(mutation);
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
    const [mutate] = useMutation(mutation, {});
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
    const [mutate] = useMutation(mutation, { variables: {} });
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
    const [mutate] = useMutation(mutation, {
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
    const [mutate] = useMutation(mutation, { variables: { id: "1" } });
    mutate();
    mutate({});
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
    const [mutate] = useMutation(mutation, {
      variables: { id: "1", language: "en" },
    });
    mutate();
    mutate({});
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
    const [mutate] = useMutation(mutation, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    mutate();
    mutate({});
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
    const [mutate] = useMutation(mutation, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    mutate();
    mutate({});
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
    const [mutate] = useMutation(mutation, {
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    mutate();
    mutate({});
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
