import { useLazyQuery } from "@apollo/client/react";
import { test, setupSimpleCase, SimpleCaseData } from "./shared.js";
import { expectTypeOf } from "expect-type";
import {
  ApolloClient,
  DataValue,
  ErrorLike,
  gql,
  TypedDocumentNode,
} from "@apollo/client";
import { DeepPartial } from "@apollo/client/utilities";

test("returns narrowed TData in default case", () => {
  const { query } = setupSimpleCase();

  const [, { data, dataState, called }] = useLazyQuery(query);

  if (!called) {
    expectTypeOf(dataState).toEqualTypeOf<"empty">();
    expectTypeOf(data).toEqualTypeOf<undefined>();
  }

  if (dataState === "complete") {
    expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
  }

  if (dataState === "streaming") {
    expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
  }

  if (dataState === "empty") {
    expectTypeOf(data).toEqualTypeOf<undefined>();
  }
});

test("returns DeepPartial<TData> with returnPartialData: true", () => {
  const { query } = setupSimpleCase();

  const [, { data, dataState, called }] = useLazyQuery(query, {
    returnPartialData: true,
  });

  if (!called) {
    expectTypeOf(dataState).toEqualTypeOf<"empty">();
    expectTypeOf(data).toEqualTypeOf<undefined>();
  }

  expectTypeOf(dataState).toEqualTypeOf<
    "empty" | "streaming" | "complete" | "partial"
  >;

  if (dataState === "complete") {
    expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
  }

  if (dataState === "partial") {
    expectTypeOf(data).toEqualTypeOf<DeepPartial<SimpleCaseData>>();
  }

  if (dataState === "streaming") {
    expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
  }

  if (dataState === "empty") {
    expectTypeOf(data).toEqualTypeOf<undefined>();
  }
});
test("NoInfer prevents adding arbitrary additional variables", () => {
  const typedNode = {} as TypedDocumentNode<{ foo: string }, { bar: number }>;
  const [execute, { variables }] = useLazyQuery(typedNode);

  void execute({
    variables: {
      bar: 4,
      // @ts-expect-error
      nonExistingVariable: "string",
    },
  });

  variables?.bar;
  // @ts-expect-error
  variables?.nonExistingVariable;
});

test("uses masked types when using masked document", async () => {
  type UserFieldsFragment = {
    __typename: "User";
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  interface UnmaskedQuery {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
      age: number;
    };
  }

  interface Subscription {
    updatedUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  interface UnmaskedSubscription {
    updatedUser: {
      __typename: "User";
      id: number;
      name: string;
      age: number;
    };
  }

  const query: TypedDocumentNode<Query> = gql``;

  const [
    execute,
    { data, previousData, subscribeToMore, fetchMore, refetch, updateQuery },
  ] = useLazyQuery(query);

  expectTypeOf(data).toEqualTypeOf<
    Query | DataValue.Streaming<Query> | undefined
  >();
  expectTypeOf(previousData).toEqualTypeOf<Query | undefined>();

  subscribeToMore({
    document: gql`` as TypedDocumentNode<Subscription, never>,
    updateQuery(queryData, { subscriptionData, complete, previousData }) {
      expectTypeOf(queryData).toEqualTypeOf<DeepPartial<UnmaskedQuery>>();
      expectTypeOf(complete).toEqualTypeOf<boolean>();
      expectTypeOf(previousData).toEqualTypeOf<
        UnmaskedQuery | DeepPartial<UnmaskedQuery> | undefined
      >();

      if (complete) {
        expectTypeOf(previousData).toEqualTypeOf<UnmaskedQuery>();
      } else {
        expectTypeOf(previousData).toEqualTypeOf<
          DeepPartial<UnmaskedQuery> | undefined
        >();
      }
      expectTypeOf(subscriptionData.data).toEqualTypeOf<UnmaskedSubscription>();

      return {} as UnmaskedQuery;
    },
  });

  updateQuery((_previousData, { complete, previousData }) => {
    expectTypeOf(_previousData).toEqualTypeOf<DeepPartial<UnmaskedQuery>>();
    expectTypeOf(complete).toEqualTypeOf<boolean>();
    expectTypeOf(previousData).toEqualTypeOf<
      UnmaskedQuery | DeepPartial<UnmaskedQuery> | undefined
    >();

    return {} as UnmaskedQuery;
  });

  {
    const { data } = await execute();

    expectTypeOf(data).toEqualTypeOf<Query>();
  }

  {
    const { data } = await fetchMore({
      variables: {},
      updateQuery: (queryData, { fetchMoreResult }) => {
        expectTypeOf(queryData).toEqualTypeOf<UnmaskedQuery>();
        expectTypeOf(fetchMoreResult).toEqualTypeOf<UnmaskedQuery>();

        return {} as UnmaskedQuery;
      },
    });

    expectTypeOf(data).toEqualTypeOf<Query | undefined>();
  }

  {
    const { data } = await refetch();

    expectTypeOf(data).toEqualTypeOf<Query>();
  }
});

test("uses unmodified types when using TypedDocumentNode", async () => {
  type UserFieldsFragment = {
    __typename: "User";
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  interface UnmaskedQuery {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
      age: number;
    };
  }

  interface Subscription {
    updatedUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  interface UnmaskedSubscription {
    updatedUser: {
      __typename: "User";
      id: number;
      name: string;
      age: number;
    };
  }

  const query: TypedDocumentNode<Query> = gql``;

  const [
    execute,
    { data, previousData, fetchMore, refetch, subscribeToMore, updateQuery },
  ] = useLazyQuery(query);

  expectTypeOf(data).toEqualTypeOf<
    Query | DataValue.Streaming<Query> | undefined
  >();
  expectTypeOf(previousData).toEqualTypeOf<Query | undefined>();

  subscribeToMore({
    document: gql`` as TypedDocumentNode<Subscription, never>,
    updateQuery(queryData, { subscriptionData, complete, previousData }) {
      expectTypeOf(queryData).toEqualTypeOf<DeepPartial<UnmaskedQuery>>();
      expectTypeOf(previousData).toEqualTypeOf<
        UnmaskedQuery | DeepPartial<UnmaskedQuery> | undefined
      >();
      expectTypeOf(subscriptionData.data).toEqualTypeOf<UnmaskedSubscription>();

      if (complete) {
        expectTypeOf(previousData).toEqualTypeOf<UnmaskedQuery>();
      } else {
        expectTypeOf(previousData).toEqualTypeOf<
          DeepPartial<UnmaskedQuery> | undefined
        >();
      }

      return {} as UnmaskedQuery;
    },
  });

  updateQuery((_previousData, { complete, previousData }) => {
    expectTypeOf(_previousData).toEqualTypeOf<DeepPartial<UnmaskedQuery>>();
    expectTypeOf(complete).toEqualTypeOf<boolean>();
    expectTypeOf(previousData).toEqualTypeOf<
      UnmaskedQuery | DeepPartial<UnmaskedQuery> | undefined
    >();

    if (complete) {
      expectTypeOf(previousData).toEqualTypeOf<UnmaskedQuery>();
    } else {
      expectTypeOf(previousData).toEqualTypeOf<
        DeepPartial<UnmaskedQuery> | undefined
      >();
    }
  });

  {
    const { data } = await execute();

    expectTypeOf(data).toEqualTypeOf<Query>();
  }

  {
    const { data } = await fetchMore({
      variables: {},
      updateQuery: (queryData, { fetchMoreResult }) => {
        expectTypeOf(queryData).toEqualTypeOf<UnmaskedQuery>();
        expectTypeOf(fetchMoreResult).toEqualTypeOf<UnmaskedQuery>();

        return {} as UnmaskedQuery;
      },
    });

    expectTypeOf(data).toEqualTypeOf<Query | undefined>();
  }

  {
    const { data } = await refetch();

    expectTypeOf(data).toEqualTypeOf<Query>();
  }
});

test("variables are optional and can be anything with an DocumentNode", () => {
  const query = gql``;

  const [execute] = useLazyQuery(query);

  void execute();
  void execute({});
  void execute({ variables: {} });
  void execute({ variables: { foo: "bar" } });
  void execute({ variables: { bar: "baz" } });
});

test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
  const query: TypedDocumentNode<{ greeting: string }> = gql``;

  const [execute] = useLazyQuery(query);

  void execute();
  void execute({});
  void execute({ variables: {} });
  void execute({ variables: { foo: "bar" } });
  void execute({ variables: { bar: "baz" } });
});

test("variables are optional when TVariables are empty", () => {
  const query: TypedDocumentNode<
    { greeting: string },
    Record<string, never>
  > = gql``;

  const [execute] = useLazyQuery(query);

  void execute();
  void execute({});
  void execute({ variables: {} });
  void execute({
    variables: {
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  });
});

test("is invalid when TVariables is `never`", () => {
  const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

  const [execute] = useLazyQuery(query);

  // @ts-expect-error
  void execute();
  // @ts-expect-error expecting variables key
  void execute({});
  // @ts-expect-error variables is never
  void execute({ variables: {} });
  // @ts-expect-error variables is never
  void execute({ variables: undefined });
  // @ts-expect-error unknown variables
  void execute({ variables: { foo: "bar" } });
});

test("optional variables are optional", () => {
  const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
    gql``;

  const [execute] = useLazyQuery(query);

  void execute();
  void execute({});
  void execute({ variables: {} });
  void execute({ variables: { limit: 10 } });
  void execute({
    variables: {
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  });
  void execute({
    variables: {
      limit: 10,
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  });
});

test("enforces required variables when TVariables includes required variables", () => {
  const query: TypedDocumentNode<{ character: string }, { id: string }> = gql``;

  const [execute] = useLazyQuery(query);

  // @ts-expect-error empty variables
  void execute();
  // @ts-expect-error empty variables
  void execute({});
  // @ts-expect-error empty variables
  void execute({ variables: {} });
  void execute({ variables: { id: "1" } });
  void execute({
    variables: {
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  });
  void execute({
    variables: {
      id: "1",
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  });
});

test("requires variables with mixed TVariables", () => {
  const query: TypedDocumentNode<
    { character: string },
    { id: string; language?: string }
  > = gql``;

  const [execute] = useLazyQuery(query);

  // @ts-expect-error empty variables
  void execute();
  // @ts-expect-error empty variables
  void execute({});
  // @ts-expect-error empty variables
  void execute({ variables: {} });
  void execute({ variables: { id: "1" } });
  void execute({
    // @ts-expect-error missing required variables
    variables: { language: "en" },
  });
  void execute({ variables: { id: "1", language: "en" } });
  void execute({
    variables: {
      id: "1",
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  });
  void execute({
    variables: {
      id: "1",
      language: "en",
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  });
});

test("execution result has `.retain` method", () => {
  const query: TypedDocumentNode<{ greeting: string }> = gql`
      query Greeting {
        greeting
      }
    `;

  const [execute] = useLazyQuery(query);
  const result = execute();

  // test assignability to a normal promise
  expectTypeOf(result).toMatchTypeOf<
    Promise<
      ApolloClient.QueryResult<{
        greeting: string;
      }>
    >
  >();

  // retain should return the same type as the original result
  expectTypeOf(result.retain()).toEqualTypeOf(result);
});

test("execute function narrows the result by errorPolicy", async () => {
  type Data = { character: string };
  const query: TypedDocumentNode<Data, Record<string, never>> = gql``;

  {
    const [execute] = useLazyQuery(query);
    const { data, error } = await execute();

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const [execute] = useLazyQuery(query, { errorPolicy: "none" });
    const { data, error } = await execute();

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const [execute] = useLazyQuery(query, { errorPolicy: "all" });
    const { data, error } = await execute();

    expectTypeOf(data).toEqualTypeOf<Data | undefined>();
    expectTypeOf(error).toEqualTypeOf<ErrorLike | undefined>();
  }

  {
    const [execute] = useLazyQuery(query, { errorPolicy: "ignore" });
    const { data, error } = await execute();

    expectTypeOf(data).toEqualTypeOf<Data | undefined>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const literalVariables: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const [execute] = useLazyQuery(literalVariables, { errorPolicy: "none" });
    const { data, error } = await execute({ variables: { type: "main" } });

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }
});

test("refetch narrows the result by errorPolicy", async () => {
  type Data = { character: string };
  const query: TypedDocumentNode<Data, Record<string, never>> = gql``;

  {
    const [, { refetch }] = useLazyQuery(query, {});
    const { data, error } = await refetch();

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const [, { refetch }] = useLazyQuery(query, { errorPolicy: "none" });
    const { data, error } = await refetch();

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const [, { refetch }] = useLazyQuery(query, { errorPolicy: "all" });
    const { data, error } = await refetch();

    expectTypeOf(data).toEqualTypeOf<Data | undefined>();
    expectTypeOf(error).toEqualTypeOf<ErrorLike | undefined>();
  }

  {
    const [, { refetch }] = useLazyQuery(query, { errorPolicy: "ignore" });
    const { data, error } = await refetch();

    expectTypeOf(data).toEqualTypeOf<Data | undefined>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }
});

test("rejects unknown options", () => {
  type Data = { character: string };
  const literalVariables: TypedDocumentNode<Data, { type: "main" }> = gql``;
  const noVariables: TypedDocumentNode<Data, Record<string, never>> = gql``;

  useLazyQuery(literalVariables, {
    returnPartialData: true,
    errorPolicy: "all",
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-first",
  });

  useLazyQuery(literalVariables, {
    // @ts-expect-error unknown option
    returnPartialDta: false,
  });

  useLazyQuery(noVariables, {
    // @ts-expect-error unknown option
    returnPartialDta: false,
  });

  useLazyQuery(literalVariables, {
    returnPartialData: true,
    // @ts-expect-error unknown option
    bogusOption: 1,
  });

  useLazyQuery(literalVariables, {
    // @ts-expect-error variables are passed to the execute function
    variables: { type: "main" },
  });
});

test("rejects a known option with an invalid value", () => {
  type Data = { character: string };
  const query: TypedDocumentNode<Data, { id: string }> = gql``;

  useLazyQuery(query, { fetchPolicy: "cache-first" });
  // @ts-expect-error invalid fetchPolicy
  useLazyQuery(query, { fetchPolicy: "bogus" });
  // @ts-expect-error invalid errorPolicy
  useLazyQuery(query, { errorPolicy: "bogus" });
});

test("rejects invalid variable values for constant variable types", () => {
  type Data = { character: string };
  const query: TypedDocumentNode<Data, { type: "main" }> = gql``;
  const stringVariables: TypedDocumentNode<Data, { id: string }> = gql``;

  const [execute] = useLazyQuery(query);
  const [executeStringVariables] = useLazyQuery(stringVariables);

  execute({ variables: { type: "main" } });
  // @ts-expect-error invalid variable value
  execute({ variables: { type: "nope" } });
  // @ts-expect-error unknown variable
  execute({ variables: { type: "main", foo: "bar" } });
  // @ts-expect-error wrong variable type
  executeStringVariables({ variables: { id: 1 } });
  // @ts-expect-error variables must be an object
  executeStringVariables({ variables: "nonsense" });
});

test("constant variable types do not widen returnPartialData", () => {
  type Data = { character: string };

  {
    const query: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const [, { dataState }] = useLazyQuery(query);

    expectTypeOf(dataState).toEqualTypeOf<"empty" | "complete" | "streaming">();
  }

  {
    const query: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const [, { dataState }] = useLazyQuery(query, {
      returnPartialData: false,
    });

    expectTypeOf(dataState).toEqualTypeOf<"empty" | "complete" | "streaming">();
  }

  {
    const query: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const [, { dataState }] = useLazyQuery(query, {
      returnPartialData: true,
    });

    expectTypeOf(dataState).toEqualTypeOf<
      "empty" | "complete" | "streaming" | "partial"
    >();
  }

  {
    const query: TypedDocumentNode<Data, { episode: 10 }> = gql``;

    const [, { dataState }] = useLazyQuery(query, {
      returnPartialData: false,
    });

    expectTypeOf(dataState).toEqualTypeOf<"empty" | "complete" | "streaming">();
  }

  {
    const query: TypedDocumentNode<Data, { main: true }> = gql``;

    const [, { dataState }] = useLazyQuery(query, {
      returnPartialData: false,
    });

    expectTypeOf(dataState).toEqualTypeOf<"empty" | "complete" | "streaming">();
  }
});
