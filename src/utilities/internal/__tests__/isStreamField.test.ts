import type { DocumentNode } from "graphql";
import { Kind } from "graphql";

import { gql } from "@apollo/client";
import {
  getQueryDefinition,
  isStreamField,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

function getRootField(document: DocumentNode) {
  const selection = getQueryDefinition(document).selectionSet.selections[0];

  invariant(selection.kind === Kind.FIELD, "Root selection must be a field");

  return selection;
}

test("returns false when the selection has no directives", () => {
  const query = gql`
    query {
      friendList {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), {})).toBe(false);
});

test("returns false when the selection has directives other than @stream", () => {
  const query = gql`
    query {
      friendList @include(if: true) {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), {})).toBe(false);
});

test("returns true for a bare @stream directive", () => {
  const query = gql`
    query {
      friendList @stream {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), {})).toBe(true);
});

test("returns true for @stream(if: true)", () => {
  const query = gql`
    query {
      friendList @stream(if: true) {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), {})).toBe(true);
});

test("returns false for @stream(if: false)", () => {
  const query = gql`
    query {
      friendList @stream(if: false) {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), {})).toBe(false);
});

test("returns true for @stream(if: $shouldStream) when the variable is true", () => {
  const query = gql`
    query ($shouldStream: Boolean!) {
      friendList @stream(if: $shouldStream) {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), { shouldStream: true })).toBe(true);
});

test("returns false for @stream(if: $shouldStream) when the variable is false", () => {
  const query = gql`
    query ($shouldStream: Boolean!) {
      friendList @stream(if: $shouldStream) {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), { shouldStream: false })).toBe(
    false
  );
});

test("returns false for @stream(if: $shouldStream) when the variable is missing", () => {
  const query = gql`
    query ($shouldStream: Boolean!) {
      friendList @stream(if: $shouldStream) {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), {})).toBe(false);
  expect(isStreamField(getRootField(query), undefined)).toBe(false);
});

test("returns true when @stream is present alongside other directives", () => {
  const query = gql`
    query {
      friendList @include(if: true) @stream {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), {})).toBe(true);
});

test("returns false when @stream(if: false) is present alongside other directives", () => {
  const query = gql`
    query {
      friendList @include(if: true) @stream(if: false) {
        name
      }
    }
  `;

  expect(isStreamField(getRootField(query), {})).toBe(false);
});

test("evaluates @stream(if: $shouldStream) per variables across repeated calls", () => {
  const query = gql`
    query ($shouldStream: Boolean!) {
      friendList @stream(if: $shouldStream) {
        name
      }
    }
  `;
  const field = getRootField(query);

  expect(isStreamField(field, { shouldStream: true })).toBe(true);
  expect(isStreamField(field, { shouldStream: true })).toBe(true);
  expect(isStreamField(field, { shouldStream: false })).toBe(false);
});
