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

test("returns narrowed Data with single generic argument", () => {
  const { data, dataState } = useQuery<SimpleCaseData>(query);

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
  const { data, dataState } = useQuery<SimpleCaseData>(query, {
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

test("variables default to OperationVariables (loose) when only Data is specified", () => {
  type Data = { foo: string };
  const typedNode = {} as TypedDocumentNode<Data, { bar: number }>;

  const { variables } = useQuery<Data>(typedNode, {
    variables: { anything: "goes", bar: 4 },
  });

  expectTypeOf(variables).toEqualTypeOf<OperationVariables>();
});

test("variables option accepts any shape when only Data is specified", () => {
  type Data = { posts: string[] };
  const query: TypedDocumentNode<Data, { limit?: number }> = gql``;

  useQuery<Data>(query);
  useQuery<Data>(query, {});
  useQuery<Data>(query, { variables: {} });
  useQuery<Data>(query, { variables: { limit: 10 } });
  useQuery<Data>(query, { variables: { foo: "bar" } });
  useQuery<Data>(query, { variables: { limit: 10, foo: "bar" } });

  let skip!: boolean;
  useQuery<Data>(query, skip ? skipToken : undefined);
  useQuery<Data>(query, skip ? skipToken : {});
  useQuery<Data>(query, skip ? skipToken : { variables: {} });
  useQuery<Data>(query, skip ? skipToken : { variables: { limit: 10 } });
  useQuery<Data>(query, skip ? skipToken : { variables: { foo: "bar" } });
});

test("returns the explicit Data even with a plain DocumentNode", () => {
  type Data = { greeting: string };
  const query = gql``;

  const { data, dataState } = useQuery<Data>(query);

  if (dataState === "complete") {
    expectTypeOf(data).toEqualTypeOf<Data>();
  }
});

test("always returns empty data/dataState with unconditional skipToken", () => {
  type Data = { character: string };
  const query: TypedDocumentNode<Data, { id: string }> = gql``;

  const { data, dataState, variables } = useQuery<Data>(query, skipToken);

  expectTypeOf(data).toEqualTypeOf<undefined>();
  expectTypeOf(dataState).toEqualTypeOf<"empty">();
  expectTypeOf(variables).toEqualTypeOf<Record<string, never>>();
});
