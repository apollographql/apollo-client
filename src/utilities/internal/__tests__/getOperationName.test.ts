import { expectTypeOf } from "expect-type";

import type { DocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";
import { getOperationName } from "@apollo/client/utilities/internal";

test("should get the operation name out of a query", () => {
  const query = gql`
    query nameOfQuery {
      fortuneCookie
    }
  `;

  const operationName = getOperationName(query);

  expect(operationName).toEqual("nameOfQuery");
});

test("should get the operation name out of a mutation", () => {
  const query = gql`
    mutation nameOfMutation {
      fortuneCookie
    }
  `;

  const operationName = getOperationName(query);

  expect(operationName).toEqual("nameOfMutation");
});

test("should return undefined if the query does not have an operation name", () => {
  const query = gql`
    {
      fortuneCookie
    }
  `;

  const operationName = getOperationName(query);

  expect(operationName).toEqual(undefined);
});

test("returns fallback if the query does not have an operation name and a fallback is provided", () => {
  const query = gql`
    {
      fortuneCookie
    }
  `;

  const operationName = getOperationName(query, "(anonymous)");

  expect(operationName).toEqual("(anonymous)");
});

declare const query: DocumentNode;

describe.skip("type tests", () => {
  test("returns string | undefined without fallback", () => {
    expectTypeOf(getOperationName(query)).toEqualTypeOf<string | undefined>();
  });

  test("returns string | undefined with undefined fallback", () => {
    expectTypeOf(getOperationName(query, undefined)).toEqualTypeOf<
      string | undefined
    >();
  });

  test("returns string with string fallback", () => {
    expectTypeOf(getOperationName(query, "anonymous")).toEqualTypeOf<string>();
  });

  test("returns string | null with null fallback", () => {
    expectTypeOf(getOperationName(query, null)).toEqualTypeOf<string | null>();
  });

  test("does not allow values other than string, null, undefined", () => {
    getOperationName(
      query,
      // @ts-expect-error
      1
    );

    getOperationName(
      query,
      // @ts-expect-error
      true
    );

    getOperationName(
      query,
      // @ts-expect-error
      {}
    );

    getOperationName(
      query,
      // @ts-expect-error
      []
    );

    getOperationName(
      query,
      // @ts-expect-error
      Symbol()
    );
  });
});
