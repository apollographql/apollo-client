import { useLazyQuery } from "@apollo/client/react";
import { test, SimpleCaseData } from "./shared.js";
import { expectTypeOf } from "expect-type";
import {
  ApolloClient,
  DataValue,
  gql,
  OperationVariables,
} from "@apollo/client";
import { DeepPartial } from "@apollo/client/utilities";

test("returns narrowed Data in default case", () => {
  const query = gql``;
  type Variables = Record<string, never>;

  {
    const [, { data, dataState, called }] = useLazyQuery<SimpleCaseData>(query);

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
  }

  {
    const [, { data, dataState, called }] = useLazyQuery<
      SimpleCaseData,
      Variables
    >(query);

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
  }
});

test("returns DeepPartial<Data> with returnPartialData: true", () => {
  const query = gql``;
  type Variables = Record<string, never>;

  {
    const [, { data, dataState, called }] = useLazyQuery<SimpleCaseData>(
      query,
      { returnPartialData: true }
    );

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
  }

  {
    const [, { data, dataState, called }] = useLazyQuery<
      SimpleCaseData,
      Variables
    >(query, { returnPartialData: true });

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
  }
});

test("prevents adding arbitrary additional variables when variables type is added", () => {
  type Data = { foo: string };
  type Variables = { bar: number };
  const query = gql``;

  const [execute, { variables }] = useLazyQuery<Data, Variables>(query);

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

  const query = gql``;

  {
    const [
      execute,
      { data, previousData, subscribeToMore, fetchMore, refetch, updateQuery },
    ] = useLazyQuery<Query>(query);

    expectTypeOf(data).toEqualTypeOf<
      Query | DataValue.Streaming<Query> | undefined
    >();
    expectTypeOf(previousData).toEqualTypeOf<Query | undefined>();

    subscribeToMore<Subscription, Record<string, never>>({
      document: gql``,
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
        expectTypeOf(
          subscriptionData.data
        ).toEqualTypeOf<UnmaskedSubscription>();

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
      expectTypeOf(data).toEqualTypeOf<Query | undefined>();
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
      expectTypeOf(data).toEqualTypeOf<Query | undefined>();
    }
  }

  {
    const [
      execute,
      { data, previousData, subscribeToMore, fetchMore, refetch, updateQuery },
    ] = useLazyQuery<Query, OperationVariables>(query);

    expectTypeOf(data).toEqualTypeOf<
      Query | DataValue.Streaming<Query> | undefined
    >();
    expectTypeOf(previousData).toEqualTypeOf<Query | undefined>();

    subscribeToMore<Subscription, Record<string, never>>({
      document: gql``,
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
        expectTypeOf(
          subscriptionData.data
        ).toEqualTypeOf<UnmaskedSubscription>();

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
      expectTypeOf(data).toEqualTypeOf<Query | undefined>();
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
      expectTypeOf(data).toEqualTypeOf<Query | undefined>();
    }
  }
});

test("OperationVariables type makes all variables optional and arbitrary", () => {
  type Data = { greeting: string };
  const query = gql``;

  {
    const [execute] = useLazyQuery<Data>(query);

    void execute();
    void execute({});
    void execute({ variables: {} });
    void execute({ variables: { foo: "bar" } });
    void execute({ variables: { bar: "baz" } });
  }

  {
    const [execute] = useLazyQuery<Data, OperationVariables>(query);

    void execute();
    void execute({});
    void execute({ variables: {} });
    void execute({ variables: { foo: "bar" } });
    void execute({ variables: { bar: "baz" } });
  }
});

test("variables are optional when Variables are empty", () => {
  type Data = { greeting: string };
  type Variables = Record<string, never>;
  const query = gql``;

  const [execute] = useLazyQuery<Data, Variables>(query);

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

test("is invalid when Variables is `never`", () => {
  type Data = { greeting: string };
  const query = gql``;

  const [execute] = useLazyQuery<Data, never>(query);

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
  type Data = { posts: string[] };
  type Variables = { limit?: number };
  const query = gql``;

  const [execute] = useLazyQuery<Data, Variables>(query);

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

test("enforces required variables when Variables includes required variables", () => {
  type Data = { character: string };
  type Variables = { id: string };
  const query = gql``;

  const [execute] = useLazyQuery<Data, Variables>(query);

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

test("requires variables with mixed Variables", () => {
  type Data = { character: string };
  type Variables = { id: string; language?: string };
  const query = gql``;

  const [execute] = useLazyQuery<Data, Variables>(query);

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
  type Data = { greeting: string };
  type Variables = OperationVariables;
  const query = gql``;

  const [execute] = useLazyQuery<Data, Variables>(query);
  const result = execute();

  expectTypeOf(result).toMatchTypeOf<Promise<ApolloClient.QueryResult<Data>>>();
  expectTypeOf(result.retain()).toEqualTypeOf(result);
});
