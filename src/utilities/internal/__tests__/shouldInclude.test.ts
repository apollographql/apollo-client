import { gql } from "@apollo/client";
import {
  cloneDeep,
  getQueryDefinition,
  shouldInclude,
} from "@apollo/client/utilities/internal";

test("should should not include a skipped field", () => {
  const query = gql`
    query {
      fortuneCookie @skip(if: true)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(!shouldInclude(field, {})).toBe(true);
});

test("should include an included field", () => {
  const query = gql`
    query {
      fortuneCookie @include(if: true)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(shouldInclude(field, {})).toBe(true);
});

test("should not include a not include: false field", () => {
  const query = gql`
    query {
      fortuneCookie @include(if: false)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(!shouldInclude(field, {})).toBe(true);
});

test("should include a skip: false field", () => {
  const query = gql`
    query {
      fortuneCookie @skip(if: false)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(shouldInclude(field, {})).toBe(true);
});

test("should not include a field if skip: true and include: true", () => {
  const query = gql`
    query {
      fortuneCookie @skip(if: true) @include(if: true)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(!shouldInclude(field, {})).toBe(true);
});

test("should not include a field if skip: true and include: false", () => {
  const query = gql`
    query {
      fortuneCookie @skip(if: true) @include(if: false)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(!shouldInclude(field, {})).toBe(true);
});

test("should include a field if skip: false and include: true", () => {
  const query = gql`
    query {
      fortuneCookie @skip(if: false) @include(if: true)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(shouldInclude(field, {})).toBe(true);
});

test("should not include a field if skip: false and include: false", () => {
  const query = gql`
    query {
      fortuneCookie @skip(if: false) @include(if: false)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(!shouldInclude(field, {})).toBe(true);
});

test("should leave the original query unmodified", () => {
  const query = gql`
    query {
      fortuneCookie @skip(if: false) @include(if: false)
    }
  `;
  const queryClone = cloneDeep(query);
  const field = getQueryDefinition(query).selectionSet.selections[0];
  shouldInclude(field, {});
  expect(query).toEqual(queryClone);
});

test("does not throw an error on an unsupported directive", () => {
  const query = gql`
    query {
      fortuneCookie @dosomething(if: true)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];

  expect(() => {
    shouldInclude(field, {});
  }).not.toThrow();
});

test("throws an error on an invalid argument for the skip directive", () => {
  const query = gql`
    query {
      fortuneCookie @skip(nothing: true)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];

  expect(() => {
    shouldInclude(field, {});
  }).toThrow();
});

test("throws an error on an invalid argument for the include directive", () => {
  const query = gql`
    query {
      fortuneCookie @include(nothing: true)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];

  expect(() => {
    shouldInclude(field, {});
  }).toThrow();
});

test("throws an error on an invalid variable name within a directive argument", () => {
  const query = gql`
    query {
      fortuneCookie @include(if: $neverDefined)
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(() => {
    shouldInclude(field, {});
  }).toThrow();
});

test("evaluates variables on skip fields", () => {
  const query = gql`
    query ($shouldSkip: Boolean) {
      fortuneCookie @skip(if: $shouldSkip)
    }
  `;
  const variables = {
    shouldSkip: true,
  };
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(!shouldInclude(field, variables)).toBe(true);
});

test("evaluates variables on include fields", () => {
  const query = gql`
    query ($shouldSkip: Boolean) {
      fortuneCookie @include(if: $shouldInclude)
    }
  `;
  const variables = {
    shouldInclude: false,
  };
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(!shouldInclude(field, variables)).toBe(true);
});

test("throws an error if the value of the argument is not a variable or boolean", () => {
  const query = gql`
    query {
      fortuneCookie @include(if: "string")
    }
  `;
  const field = getQueryDefinition(query).selectionSet.selections[0];
  expect(() => {
    shouldInclude(field, {});
  }).toThrow();
});
