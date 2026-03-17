import { DataValue, gql, TypedDocumentNode } from "@apollo/client";
import { skipToken, useQuery } from "@apollo/client/react";
import { DeepPartial } from "@apollo/client/utilities";
import { expectTypeOf } from "expect-type";
import { test, simpleQuery as query, SimpleCaseData } from "./shared.js";

test("returns narrowed TData in default case", () => {
  const { data, dataState } = useQuery(query);

  expectTypeOf(dataState).toEqualTypeOf<"empty" | "streaming" | "complete">();

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
  const { data, dataState } = useQuery(query, { returnPartialData: true });

  expectTypeOf(dataState).toEqualTypeOf<
    "empty" | "streaming" | "complete" | "partial"
  >();

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
  const { variables } = useQuery(typedNode, {
    variables: {
      bar: 4,
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'.ts(2769)
      nonExistingVariable: "string",
    },
  });
  variables?.bar;
  // @ts-expect-error
  variables?.nonExistingVariable;
});

test("variables are optional and can be anything with an DocumentNode", () => {
  const query = gql``;

  useQuery(query);
  useQuery(query, {});
  useQuery(query, { variables: {} });
  useQuery(query, { variables: { foo: "bar" } });
  useQuery(query, { variables: { bar: "baz" } });

  let skip!: boolean;
  useQuery(query, skip ? skipToken : undefined);
  useQuery(query, skip ? skipToken : {});
  useQuery(query, skip ? skipToken : { variables: {} });
  useQuery(query, skip ? skipToken : { variables: { foo: "bar" } });
  useQuery(query, skip ? skipToken : { variables: { bar: "baz" } });
});

test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
  const query: TypedDocumentNode<{ greeting: string }> = gql``;

  useQuery(query);
  useQuery(query, {});
  useQuery(query, { variables: {} });
  useQuery(query, { variables: { foo: "bar" } });
  useQuery(query, { variables: { bar: "baz" } });

  let skip!: boolean;
  useQuery(query, skip ? skipToken : undefined);
  useQuery(query, skip ? skipToken : {});
  useQuery(query, skip ? skipToken : { variables: {} });
  useQuery(query, skip ? skipToken : { variables: { foo: "bar" } });
  useQuery(query, skip ? skipToken : { variables: { bar: "baz" } });
});

test("variables are optional when TVariables are empty", () => {
  const query: TypedDocumentNode<
    { greeting: string },
    Record<string, never>
  > = gql``;

  useQuery(query);
  useQuery(query, {});
  useQuery(query, { variables: {} });
  useQuery(query, {
    variables: {
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'.ts(2769)
      foo: "bar",
    },
  });

  let skip!: boolean;
  useQuery(query, skip ? skipToken : undefined);
  useQuery(query, skip ? skipToken : {});
  useQuery(query, skip ? skipToken : { variables: {} });
  useQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : { variables: { foo: "bar" } }
  );
});

/* TODO
  test("is invalid when TVariables is `never`", () => {
    const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

    // @ts-expect-error
    useQuery(query);
    // @ts-expect-error
    useQuery(query, {});
    useQuery(query, {
      // @ts-expect-error
      variables: {},
    });
    useQuery(query, {
      // @ts-expect-error
      variables: undefined,
    });
    useQuery(query, {
      // @ts-expect-error
      variables: {
        foo: "bar",
      },
    });

    let skip!: boolean;
    // @ts-expect-error
    useQuery(query, skip ? skipToken : undefined);
    useQuery(
      query,
      // @ts-expect-error
      skip ? skipToken : {}
    );
    useQuery(
      query,
      // @ts-expect-error
      skip ? skipToken : { variables: {} }
    );
    useQuery(
      query,
      // @ts-expect-error
      skip ? skipToken : { variables: undefined }
    );
    useQuery(
      query,
      // @ts-expect-error unknown variables
      skip ? skipToken : { variables: { foo: "bar" } }
    );
  });
  */

test("optional variables are optional", () => {
  const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
    gql``;

  useQuery(query);
  useQuery(query, {});
  useQuery(query, { variables: {} });
  useQuery(query, { variables: { limit: 10 } });

  useQuery(query, {
    variables: {
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'
      foo: "bar",
    },
  });

  useQuery(query, {
    variables: {
      limit: 10,
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'
      foo: "bar",
    },
  });

  let skip!: boolean;
  useQuery(query, skip ? skipToken : undefined);
  useQuery(query, skip ? skipToken : {});
  useQuery(query, skip ? skipToken : { variables: {} });
  useQuery(query, skip ? skipToken : { variables: { limit: 10 } });
  useQuery(
    query,
    skip ? skipToken : (
      {
        variables: {
          // @ts-expect-error unknown variables
          foo: "bar",
        },
      }
    )
  );
  useQuery(
    query,
    skip ? skipToken : (
      {
        variables: {
          limit: 10,
          // @ts-expect-error unknown variables
          foo: "bar",
        },
      }
    )
  );
});

test("enforces required variables when TVariables includes required variables", () => {
  const query: TypedDocumentNode<{ character: string }, { id: string }> = gql``;

  // @ts-expect-error empty variables
  useQuery(query);
  // @ts-expect-error empty variables
  const ret = useQuery(query, {});
  // @ts-expect-error empty variables
  useQuery(query, { variables: {} });
  useQuery(query, { variables: { id: "1" } });
  useQuery(query, {
    variables: {
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'
      foo: "bar",
    },
  });

  useQuery(query, {
    variables: {
      id: "1",
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error missing variables option
  useQuery(query, skip ? skipToken : undefined);
  useQuery(
    query,
    // @ts-expect-error missing variables option
    skip ? skipToken : {}
  );
  useQuery(
    query,
    // @ts-expect-error missing required variables
    skip ? skipToken : { variables: {} }
  );
  useQuery(query, skip ? skipToken : { variables: { id: "1" } });
  useQuery(
    query,
    skip ? skipToken : (
      {
        variables: {
          // @ts-expect-error unknown variables
          foo: "bar",
        },
      }
    )
  );
  useQuery(
    query,
    skip ? skipToken : (
      {
        variables: {
          id: "1",
          // @ts-expect-error unknown variables
          foo: "bar",
        },
      }
    )
  );
});

test("requires variables with mixed TVariables", () => {
  const query: TypedDocumentNode<
    { character: string },
    { id: string; language?: string }
  > = gql``;

  // @ts-expect-error empty variables
  useQuery(query);
  // @ts-expect-error empty variables
  useQuery(query, {});
  // @ts-expect-error empty variables
  useQuery(query, { variables: {} });
  useQuery(query, { variables: { id: "1" } });
  useQuery(query, {
    // @ts-expect-error Property 'id' is missing in type '{ language: string; }' but required in type '{ id: string; language?: string | undefined; }'.ts(2769)
    variables: { language: "en" },
  });
  useQuery(query, { variables: { id: "1", language: "en" } });
  useQuery(query, {
    variables: {
      id: "1",
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'.ts(2769)
      foo: "bar",
    },
  });

  useQuery(query, {
    variables: {
      id: "1",
      language: "en",
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'.ts(2769)
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error missing variables option
  useQuery(query, skip ? skipToken : undefined);
  useQuery(
    query,
    // @ts-expect-error missing variables option
    skip ? skipToken : {}
  );
  useQuery(
    query,
    // @ts-expect-error missing required variables
    skip ? skipToken : { variables: {} }
  );
  useQuery(query, skip ? skipToken : { variables: { id: "1" } });
  useQuery(
    query,
    skip ? skipToken : { variables: { id: "1", language: "en" } }
  );
  useQuery(
    query,
    skip ? skipToken : (
      {
        variables: {
          id: "1",
          // @ts-expect-error unknown variables
          foo: "bar",
        },
      }
    )
  );
  useQuery(
    query,
    skip ? skipToken : (
      {
        variables: {
          id: "1",
          language: "en",
          // @ts-expect-error unknown variables
          foo: "bar",
        },
      }
    )
  );
});

test("always returns empty data/dataState with unconditional skipToken", () => {
  const query: TypedDocumentNode<
    { character: string },
    { id: string; language?: string }
  > = gql``;

  const { data, dataState, variables } = useQuery(query, skipToken);

  expectTypeOf(data).toEqualTypeOf<undefined>();
  expectTypeOf(dataState).toEqualTypeOf<"empty">();
  expectTypeOf(variables).toEqualTypeOf<Record<string, never>>();
});
