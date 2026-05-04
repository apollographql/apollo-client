import {
  DataValue,
  gql,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { skipToken, useQuery } from "@apollo/client/react";
import { DeepPartial } from "@apollo/client/utilities";
import { expectTypeOf } from "expect-type";
import { test, simpleQuery as query, SimpleCaseData } from "./shared.js";

test("returns narrowed Data in default case", () => {
  type Variables = Record<string, never>;
  const { data, dataState } = useQuery<SimpleCaseData, Variables>(query);

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

test("returns DeepPartial<Data> with returnPartialData: true", () => {
  type Variables = Record<string, never>;
  const { data, dataState } = useQuery<SimpleCaseData, Variables>(query, {
    returnPartialData: true,
  });

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
  type Data = { foo: string };
  type Variables = { bar: number };
  const typedNode = {} as TypedDocumentNode<Data, Variables>;
  const { variables } = useQuery<Data, Variables>(typedNode, {
    variables: {
      bar: 4,
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'.ts(2769)
      nonExistingVariable: "string",
    },
  });

  const x: number = variables?.bar;
  // @ts-expect-error
  const y: string = variables?.nonExistingVariable;
});

test("variables are optional and can be anything with an DocumentNode", () => {
  type Data = unknown;
  type Variables = OperationVariables;
  const query = gql``;

  useQuery<Data, Variables>(query);
  useQuery<Data, Variables>(query, {});
  useQuery<Data, Variables>(query, { variables: {} });
  useQuery<Data, Variables>(query, { variables: { foo: "bar" } });
  useQuery<Data, Variables>(query, { variables: { bar: "baz" } });

  let skip!: boolean;
  useQuery<Data, Variables>(query, skip ? skipToken : undefined);
  useQuery<Data, Variables>(query, skip ? skipToken : {});
  useQuery<Data, Variables>(query, skip ? skipToken : { variables: {} });
  useQuery<Data, Variables>(
    query,
    skip ? skipToken : { variables: { foo: "bar" } }
  );
  useQuery<Data, Variables>(
    query,
    skip ? skipToken : { variables: { bar: "baz" } }
  );
});

test("variables are optional and can be anything with unspecified Variables on a TypedDocumentNode", () => {
  type Data = { greeting: string };
  type Variables = OperationVariables;
  const query: TypedDocumentNode<Data> = gql``;

  useQuery<Data, Variables>(query);
  useQuery<Data, Variables>(query, {});
  useQuery<Data, Variables>(query, { variables: {} });
  useQuery<Data, Variables>(query, { variables: { foo: "bar" } });
  useQuery<Data, Variables>(query, { variables: { bar: "baz" } });

  let skip!: boolean;
  useQuery<Data, Variables>(query, skip ? skipToken : undefined);
  useQuery<Data, Variables>(query, skip ? skipToken : {});
  useQuery<Data, Variables>(query, skip ? skipToken : { variables: {} });
  useQuery<Data, Variables>(
    query,
    skip ? skipToken : { variables: { foo: "bar" } }
  );
  useQuery<Data, Variables>(
    query,
    skip ? skipToken : { variables: { bar: "baz" } }
  );
});

test("variables are optional when Variables are empty", () => {
  type Data = { greeting: string };
  type Variables = Record<string, never>;
  const query: TypedDocumentNode<Data, Variables> = gql``;

  useQuery<Data, Variables>(query);
  useQuery<Data, Variables>(query, {});
  useQuery<Data, Variables>(query, { variables: {} });
  useQuery<Data, Variables>(query, {
    variables: {
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'.ts(2769)
      foo: "bar",
    },
  });

  let skip!: boolean;
  useQuery<Data, Variables>(query, skip ? skipToken : undefined);
  useQuery<Data, Variables>(query, skip ? skipToken : {});
  useQuery<Data, Variables>(query, skip ? skipToken : { variables: {} });
  useQuery<Data, Variables>(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : { variables: { foo: "bar" } }
  );
});

test("is invalid when Variables is `never`", () => {
  type Data = { greeting: string };
  type Variables = never;
  const query: TypedDocumentNode<Data, Variables> = gql``;

  // @ts-expect-error
  useQuery<Data, Variables>(query);
  // @ts-expect-error
  useQuery<Data, Variables>(query, {});
  useQuery<Data, Variables>(query, {
    // @ts-expect-error
    variables: {},
  });
  useQuery<Data, Variables>(query, {
    // @ts-expect-error
    variables: undefined,
  });
  useQuery<Data, Variables>(query, {
    // @ts-expect-error
    variables: {
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error
  useQuery<Data, Variables>(query, skip ? skipToken : undefined);
  useQuery<Data, Variables>(
    query,
    // @ts-expect-error
    skip ? skipToken : {}
  );
  useQuery<Data, Variables>(
    query,
    // @ts-expect-error
    skip ? skipToken : { variables: {} }
  );
  useQuery<Data, Variables>(
    query,
    // @ts-expect-error
    skip ? skipToken : { variables: undefined }
  );
  useQuery<Data, Variables>(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : { variables: { foo: "bar" } }
  );
});

test("optional variables are optional", () => {
  type Data = { posts: string[] };
  type Variables = { limit?: number };
  const query: TypedDocumentNode<Data, Variables> = gql``;

  useQuery<Data, Variables>(query);
  useQuery<Data, Variables>(query, {});
  useQuery<Data, Variables>(query, { variables: {} });
  useQuery<Data, Variables>(query, { variables: { limit: 10 } });

  useQuery<Data, Variables>(query, {
    variables: {
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'
      foo: "bar",
    },
  });

  useQuery<Data, Variables>(query, {
    variables: {
      limit: 10,
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'
      foo: "bar",
    },
  });

  let skip!: boolean;
  useQuery<Data, Variables>(query, skip ? skipToken : undefined);
  useQuery<Data, Variables>(query, skip ? skipToken : {});
  useQuery<Data, Variables>(query, skip ? skipToken : { variables: {} });
  useQuery<Data, Variables>(
    query,
    skip ? skipToken : { variables: { limit: 10 } }
  );
  useQuery<Data, Variables>(
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
  useQuery<Data, Variables>(
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

test("enforces required variables when Variables includes required variables", () => {
  type Data = { character: string };
  type Variables = { id: string };
  const query: TypedDocumentNode<Data, Variables> = gql``;

  // @ts-expect-error empty variables
  useQuery<Data, Variables>(query);
  // @ts-expect-error empty variables
  const ret = useQuery<Data, Variables>(query, {});
  // @ts-expect-error empty variables
  useQuery<Data, Variables>(query, { variables: {} });
  useQuery<Data, Variables>(query, { variables: { id: "1" } });
  useQuery<Data, Variables>(query, {
    variables: {
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'
      foo: "bar",
    },
  });

  useQuery<Data, Variables>(query, {
    variables: {
      id: "1",
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error missing variables option
  useQuery<Data, Variables>(query, skip ? skipToken : undefined);
  useQuery<Data, Variables>(
    query,
    // @ts-expect-error missing variables option
    skip ? skipToken : {}
  );
  useQuery<Data, Variables>(
    query,
    // @ts-expect-error missing required variables
    skip ? skipToken : { variables: {} }
  );
  useQuery<Data, Variables>(
    query,
    skip ? skipToken : { variables: { id: "1" } }
  );
  useQuery<Data, Variables>(
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
  useQuery<Data, Variables>(
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

test("requires variables with mixed Variables", () => {
  type Data = { character: string };
  type Variables = { id: string; language?: string };
  const query: TypedDocumentNode<Data, Variables> = gql``;

  // @ts-expect-error empty variables
  useQuery<Data, Variables>(query);
  // @ts-expect-error empty variables
  useQuery<Data, Variables>(query, {});
  // @ts-expect-error empty variables
  useQuery<Data, Variables>(query, { variables: {} });
  useQuery<Data, Variables>(query, { variables: { id: "1" } });
  useQuery<Data, Variables>(query, {
    // @ts-expect-error Property 'id' is missing in type '{ language: string; }' but required in type '{ id: string; language?: string | undefined; }'.ts(2769)
    variables: { language: "en" },
  });
  useQuery<Data, Variables>(query, {
    variables: { id: "1", language: "en" },
  });
  useQuery<Data, Variables>(query, {
    variables: {
      id: "1",
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'.ts(2769)
      foo: "bar",
    },
  });

  useQuery<Data, Variables>(query, {
    variables: {
      id: "1",
      language: "en",
      // @ts-expect-error Type 'string' is not assignable to type 'undefined'.ts(2769)
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error missing variables option
  useQuery<Data, Variables>(query, skip ? skipToken : undefined);
  useQuery<Data, Variables>(
    query,
    // @ts-expect-error missing variables option
    skip ? skipToken : {}
  );
  useQuery<Data, Variables>(
    query,
    // @ts-expect-error missing required variables
    skip ? skipToken : { variables: {} }
  );
  useQuery<Data, Variables>(
    query,
    skip ? skipToken : { variables: { id: "1" } }
  );
  useQuery<Data, Variables>(
    query,
    skip ? skipToken : { variables: { id: "1", language: "en" } }
  );
  useQuery<Data, Variables>(
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
  useQuery<Data, Variables>(
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
  type Data = { character: string };
  type Variables = { id: string; language?: string };
  const query: TypedDocumentNode<Data, Variables> = gql``;

  const { data, dataState, variables } = useQuery<Data, Variables>(
    query,
    skipToken
  );

  expectTypeOf(data).toEqualTypeOf<undefined>();
  expectTypeOf(dataState).toEqualTypeOf<"empty">();
  expectTypeOf(variables).toEqualTypeOf<Record<string, never>>();
});
