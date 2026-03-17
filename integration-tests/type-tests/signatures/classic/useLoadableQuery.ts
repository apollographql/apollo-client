import {
  DataValue,
  gql,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { QueryRef, useLoadableQuery, useReadQuery } from "@apollo/client/react";
import { DeepPartial } from "@apollo/client/utilities";
import { invariant } from "@apollo/client/utilities/invariant";
import { expectTypeOf } from "expect-type";
import {
  it,
  VariablesCaseData,
  VariablesCaseVariables,
  useVariablesQueryCase,
} from "./shared.js";
it("returns unknown when TData cannot be inferred", () => {
  const query = gql``;

  const [, queryRef] = useLoadableQuery(query);

  invariant(queryRef);

  const { data } = useReadQuery(queryRef);

  expectTypeOf(data).toEqualTypeOf<unknown>();
  expectTypeOf(queryRef).toEqualTypeOf<
    QueryRef<unknown, OperationVariables, "complete" | "streaming">
  >;
});

it("variables are optional and can be anything with an untyped DocumentNode", () => {
  const query = gql``;

  const [loadQuery] = useLoadableQuery(query);

  loadQuery();
  loadQuery({});
  loadQuery({ foo: "bar" });
  loadQuery({ bar: "baz" });
});

it("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
  const query: TypedDocumentNode<{ greeting: string }> = gql``;

  const [loadQuery] = useLoadableQuery(query);

  loadQuery();
  loadQuery({});
  loadQuery({ foo: "bar" });
  loadQuery({ bar: "baz" });
});

it("variables are optional when TVariables are empty", () => {
  const query: TypedDocumentNode<
    { greeting: string },
    Record<string, never>
  > = gql``;

  const [loadQuery] = useLoadableQuery(query);

  loadQuery();
  loadQuery({});
  // @ts-expect-error unknown variable
  loadQuery({ foo: "bar" });
});

it("is not valid when TVariables is `never`", () => {
  const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

  const [loadQuery] = useLoadableQuery(query);

  // @ts-expect-error
  loadQuery();
  // @ts-expect-error no variables argument allowed
  loadQuery({});
  // @ts-expect-error no variables argument allowed
  loadQuery({ foo: "bar" });
});

it("optional variables are optional to loadQuery", () => {
  const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
    gql``;

  const [loadQuery] = useLoadableQuery(query);

  loadQuery();
  loadQuery({});
  loadQuery({ limit: 10 });
  loadQuery({
    // @ts-expect-error unknown variable
    foo: "bar",
  });
  loadQuery({
    limit: 10,
    // @ts-expect-error unknown variable
    foo: "bar",
  });
});

it("enforces required variables when TVariables includes required variables", () => {
  const query: TypedDocumentNode<{ character: string }, { id: string }> = gql``;

  const [loadQuery] = useLoadableQuery(query);

  // @ts-expect-error missing variables argument
  loadQuery();
  // @ts-expect-error empty variables
  loadQuery({});
  loadQuery({ id: "1" });
  loadQuery({
    // @ts-expect-error unknown variable
    foo: "bar",
  });
  loadQuery({
    id: "1",
    // @ts-expect-error unknown variable
    foo: "bar",
  });
});

it("requires variables with mixed TVariables", () => {
  const query: TypedDocumentNode<
    { character: string },
    { id: string; language?: string }
  > = gql``;

  const [loadQuery] = useLoadableQuery(query);

  // @ts-expect-error missing variables argument
  loadQuery();
  // @ts-expect-error empty variables
  loadQuery({});
  loadQuery({ id: "1" });
  // @ts-expect-error missing required variable
  loadQuery({ language: "en" });
  loadQuery({ id: "1", language: "en" });
  loadQuery({
    // @ts-expect-error unknown variable
    foo: "bar",
  });
  loadQuery({
    id: "1",
    // @ts-expect-error unknown variable
    foo: "bar",
  });
  loadQuery({
    id: "1",
    language: "en",
    // @ts-expect-error unknown variable
    foo: "bar",
  });
});

it("returns TData in default case", () => {
  const { query } = useVariablesQueryCase();

  {
    const [, queryRef] = useLoadableQuery(query);

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query);

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }
});

it('returns TData | undefined with errorPolicy: "ignore"', () => {
  const { query } = useVariablesQueryCase();

  {
    const [, queryRef] = useLoadableQuery(query, {
      errorPolicy: "ignore",
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { errorPolicy: "ignore" });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }
});

it('returns TData | undefined with errorPolicy: "all"', () => {
  const { query } = useVariablesQueryCase();

  {
    const [, queryRef] = useLoadableQuery(query, {
      errorPolicy: "all",
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { errorPolicy: "all" });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }
});

it('returns TData with errorPolicy: "none"', () => {
  const { query } = useVariablesQueryCase();

  {
    const [, queryRef] = useLoadableQuery(query, {
      errorPolicy: "none",
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { errorPolicy: "none" });

    invariant(queryRef);

    const { data } = useReadQuery(queryRef);

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
  }
});

it("returns DeepPartial<TData> with returnPartialData: true", () => {
  const { query } = useVariablesQueryCase();

  {
    const [, queryRef] = useLoadableQuery(query, {
      returnPartialData: true,
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { returnPartialData: true });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  }
});

it("returns TData with returnPartialData: false", () => {
  const { query } = useVariablesQueryCase();

  {
    const [, queryRef] = useLoadableQuery(query, {
      returnPartialData: false,
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { returnPartialData: false });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }
});

it("returns TData when passing an option that does not affect TData", () => {
  const { query } = useVariablesQueryCase();

  {
    const [, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "no-cache",
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { fetchPolicy: "no-cache" });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }
});

it("handles combinations of options", () => {
  const { query } = useVariablesQueryCase();

  {
    const [, queryRef] = useLoadableQuery(query, {
      returnPartialData: true,
      errorPolicy: "ignore",
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
      | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial" | "empty"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { returnPartialData: true, errorPolicy: "ignore" });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
      | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial" | "empty"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  {
    const [, queryRef] = useLoadableQuery(query, {
      returnPartialData: true,
      errorPolicy: "none",
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { returnPartialData: true, errorPolicy: "none" });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  }
});

it("returns correct TData type when combined options that do not affect TData", () => {
  const { query } = useVariablesQueryCase();

  {
    const [, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  }

  {
    const [, queryRef] = useLoadableQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
    });

    invariant(queryRef);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  }
});
