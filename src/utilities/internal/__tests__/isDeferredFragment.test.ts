import type { DocumentNode } from "graphql";
import { Kind } from "graphql";

import { gql } from "@apollo/client";
import {
  getQueryDefinition,
  isDeferredFragment,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

function getRootFragment(document: DocumentNode) {
  const selection = getQueryDefinition(document).selectionSet.selections[0];

  invariant(
    selection.kind === Kind.FRAGMENT_SPREAD ||
      selection.kind === Kind.INLINE_FRAGMENT,
    "Root selection must be a fragment spread or inline fragment"
  );

  return selection;
}

test("returns false when the selection has no directives", () => {
  const query = gql`
    query {
      ... on Greeting {
        name
      }
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(false);
});

test("returns false when the selection has directives other than @defer", () => {
  const query = gql`
    query {
      ... on Greeting @include(if: true) {
        name
      }
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(false);
});

test("returns true for a bare @defer directive", () => {
  const query = gql`
    query {
      ... on Greeting @defer {
        name
      }
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(true);
});

test("returns true for @defer(if: true)", () => {
  const query = gql`
    query {
      ... on Greeting @defer(if: true) {
        name
      }
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(true);
});

test("returns false for @defer(if: false)", () => {
  const query = gql`
    query {
      ... on Greeting @defer(if: false) {
        name
      }
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(false);
});

test("returns true for @defer(if: $shouldDefer) when the variable is true", () => {
  const query = gql`
    query ($shouldDefer: Boolean!) {
      ... on Greeting @defer(if: $shouldDefer) {
        name
      }
    }
  `;

  expect(
    isDeferredFragment(getRootFragment(query), { shouldDefer: true })
  ).toBe(true);
});

test("returns false for @defer(if: $shouldDefer) when the variable is false", () => {
  const query = gql`
    query ($shouldDefer: Boolean!) {
      ... on Greeting @defer(if: $shouldDefer) {
        name
      }
    }
  `;

  expect(
    isDeferredFragment(getRootFragment(query), { shouldDefer: false })
  ).toBe(false);
});

test("returns false for @defer(if: $shouldDefer) when the variable is missing", () => {
  const query = gql`
    query ($shouldDefer: Boolean!) {
      ... on Greeting @defer(if: $shouldDefer) {
        name
      }
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(false);
  expect(isDeferredFragment(getRootFragment(query), undefined)).toBe(false);
});

test("returns true for a named fragment spread with bare @defer", () => {
  const query = gql`
    query {
      ...GreetingFields @defer
    }

    fragment GreetingFields on Greeting {
      name
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(true);
});

test("returns false for a named fragment spread with @defer(if: false)", () => {
  const query = gql`
    query {
      ...GreetingFields @defer(if: false)
    }

    fragment GreetingFields on Greeting {
      name
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(false);
});

test("returns true for a named fragment spread with @defer(if: $shouldDefer) when the variable is true", () => {
  const query = gql`
    query ($shouldDefer: Boolean!) {
      ...GreetingFields @defer(if: $shouldDefer)
    }

    fragment GreetingFields on Greeting {
      name
    }
  `;

  expect(
    isDeferredFragment(getRootFragment(query), { shouldDefer: true })
  ).toBe(true);
});

test("returns false for a named fragment spread with @defer(if: $shouldDefer) when the variable is false", () => {
  const query = gql`
    query ($shouldDefer: Boolean!) {
      ...GreetingFields @defer(if: $shouldDefer)
    }

    fragment GreetingFields on Greeting {
      name
    }
  `;

  expect(
    isDeferredFragment(getRootFragment(query), { shouldDefer: false })
  ).toBe(false);
});

test("returns true when @defer is present alongside other directives", () => {
  const query = gql`
    query {
      ... on Greeting @include(if: true) @defer {
        name
      }
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(true);
});

test("returns false when @defer(if: false) is present alongside other directives", () => {
  const query = gql`
    query {
      ... on Greeting @include(if: true) @defer(if: false) {
        name
      }
    }
  `;

  expect(isDeferredFragment(getRootFragment(query), {})).toBe(false);
});

test("evaluates @defer(if: $shouldDefer) per variables across repeated calls", () => {
  const query = gql`
    query ($shouldDefer: Boolean!) {
      ... on Greeting @defer(if: $shouldDefer) {
        name
      }
    }
  `;
  const fragment = getRootFragment(query);

  expect(isDeferredFragment(fragment, { shouldDefer: true })).toBe(true);
  expect(isDeferredFragment(fragment, { shouldDefer: true })).toBe(true);
  expect(isDeferredFragment(fragment, { shouldDefer: false })).toBe(false);
});
