import type { FragmentDefinitionNode } from "graphql";
import { Kind, parse } from "graphql";

import { gql } from "@apollo/client";
import { removeMaskedFragmentSpreads } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

test("removes masked fragment spreads", () => {
  const query = gql`
    query {
      user {
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      name
    }
  `;

  expect(removeMaskedFragmentSpreads(query)).toMatchDocument(gql`
    query {
      user {
        id
      }
    }

    fragment UserFields on User {
      name
    }
  `);
});

test("removes masked fragment spreads inside fragment definitions", () => {
  const query = gql`
    query {
      user {
        id
        ...UserFields @unmask
      }
    }

    fragment UserFields on User {
      name
      ...UserAvatar
    }

    fragment UserAvatar on User {
      avatar
    }
  `;

  expect(removeMaskedFragmentSpreads(query)).toMatchDocument(gql`
    query {
      user {
        id
        ...UserFields @unmask
      }
    }

    fragment UserFields on User {
      name
    }

    fragment UserAvatar on User {
      avatar
    }
  `);
});

test("keeps fragment spreads with @unmask", () => {
  const query = gql`
    query {
      user {
        id
        ...UserFields @unmask
        ...UserAvatar @unmask(mode: "migrate")
      }
    }

    fragment UserFields on User {
      name
    }

    fragment UserAvatar on User {
      avatar
    }
  `;

  expect(removeMaskedFragmentSpreads(query)).toMatchDocument(query);
});

test("removes masked fragment spreads to fragments that use no variables in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      user {
        id
        avatar(size: $size)
        ...UserFields
      }
    }

    fragment UserFields on User {
      name
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($size: Int) {
        user {
          id
          avatar(size: $size)
        }
      }

      fragment UserFields on User {
        name
      }
    `
  );
});

test("marks masked fragment spreads to fragments that use operation variables in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      user {
        id
        ...UserAvatar
      }
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($size: Int) {
        user {
          id
          ...UserAvatar @_apollo(mask: true)
        }
      }

      fragment UserAvatar on User {
        avatar(size: $size)
      }
    `
  );
});

test("marks masked fragment spreads to fragments that use operation variables in directives in mark mode", () => {
  const query = gql`
    query ($includeName: Boolean!) {
      user {
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      name @include(if: $includeName)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($includeName: Boolean!) {
        user {
          id
          ...UserFields @_apollo(mask: true)
        }
      }

      fragment UserFields on User {
        name @include(if: $includeName)
      }
    `
  );
});

test("marks masked fragment spreads to fragments that use operation variables in nested selection sets and inline fragments in mark mode", () => {
  const query = gql`
    query ($first: Int, $size: Int) {
      user {
        id
        ...UserFriends
      }
    }

    fragment UserFriends on User {
      friends(first: $first) {
        id
      }
      ... on User {
        bestFriend {
          avatar(size: $size)
        }
      }
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($first: Int, $size: Int) {
        user {
          id
          ...UserFriends @_apollo(mask: true)
        }
      }

      fragment UserFriends on User {
        friends(first: $first) {
          id
        }
        ... on User {
          bestFriend {
            avatar(size: $size)
          }
        }
      }
    `
  );
});

test("marks masked fragment spreads to fragments whose nested fragment spreads use operation variables in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      user {
        id
        ...UserCard
      }
    }

    fragment UserCard on User {
      name
      ...UserAvatar
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($size: Int) {
        user {
          id
          ...UserCard @_apollo(mask: true)
        }
      }

      fragment UserCard on User {
        name
        ...UserAvatar @_apollo(mask: true)
      }

      fragment UserAvatar on User {
        avatar(size: $size)
      }
    `
  );
});

test("removes masked fragment spreads to fragments that use operation variables in remove mode", () => {
  const query = gql`
    query ($size: Int) {
      user {
        id
        ...UserAvatar
      }
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query)).toMatchDocument(gql`
    query ($size: Int) {
      user {
        id
      }
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `);
});

test("removes masked fragment spreads to fragments missing from the document in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      user {
        id
        ...UserAvatar
        ...toString
        ...constructor
      }
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($size: Int) {
        user {
          id
        }
      }
    `
  );
});

test("removes masked fragment spreads whose only variable is in a directive on the spread in mark mode", () => {
  const query = gql`
    query ($flag: Boolean!) {
      user {
        id
        ...UserAvatar @include(if: $flag)
      }
    }

    fragment UserAvatar on User {
      avatar
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($flag: Boolean!) {
        user {
          id
        }
      }

      fragment UserAvatar on User {
        avatar
      }
    `
  );
});

test("marks masked fragment spreads to fragments whose unmasked nested fragment spreads use operation variables in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      user {
        id
        ...UserCard
      }
    }

    fragment UserCard on User {
      name
      ...UserAvatar @unmask
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($size: Int) {
        user {
          id
          ...UserCard @_apollo(mask: true)
        }
      }

      fragment UserCard on User {
        name
        ...UserAvatar @unmask
      }

      fragment UserAvatar on User {
        avatar(size: $size)
      }
    `
  );
});

test("marks only the masked spreads of a fragment that is also spread with @unmask in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      lead {
        id
        ...UserAvatar
      }
      member {
        id
        ...UserAvatar @unmask
      }
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($size: Int) {
        lead {
          id
          ...UserAvatar @_apollo(mask: true)
        }
        member {
          id
          ...UserAvatar @unmask
        }
      }

      fragment UserAvatar on User {
        avatar(size: $size)
      }
    `
  );
});

test("marks masked fragment spreads to fragments that use operation variables in object and list arguments in mark mode", () => {
  const query = gql`
    query ($size: Int, $tag: String) {
      user {
        id
        ...UserAvatar
      }
    }

    fragment UserAvatar on User {
      avatar(options: { size: $size }, tags: [$tag])
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($size: Int, $tag: String) {
        user {
          id
          ...UserAvatar @_apollo(mask: true)
        }
      }

      fragment UserAvatar on User {
        avatar(options: { size: $size }, tags: [$tag])
      }
    `
  );
});

test("marks masked fragment spreads to fragments that use operation variables in directives on inline fragments in mark mode", () => {
  const query = gql`
    query ($deferBio: Boolean!) {
      user {
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      name
      ... @defer(if: $deferBio) {
        bio
      }
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($deferBio: Boolean!) {
        user {
          id
          ...UserFields @_apollo(mask: true)
        }
      }

      fragment UserFields on User {
        name
        ... @defer(if: $deferBio) {
          bio
        }
      }
    `
  );
});

test("marks masked fragment spreads to fragments that use operation variables in directives on the fragment definition in mark mode", () => {
  const query = gql`
    query ($x: Int) {
      user {
        id
        ...UserFields
      }
    }

    fragment UserFields on User @custom(x: $x) {
      name
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($x: Int) {
        user {
          id
          ...UserFields @_apollo(mask: true)
        }
      }

      fragment UserFields on User @custom(x: $x) {
        name
      }
    `
  );
});

test("marks masked fragment spreads inside inline fragments in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      node {
        ... on User {
          id
          ...UserAvatar
        }
      }
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($size: Int) {
        node {
          ... on User {
            id
            ...UserAvatar @_apollo(mask: true)
          }
        }
      }

      fragment UserAvatar on User {
        avatar(size: $size)
      }
    `
  );
});

test("marks masked fragment spreads in mutations and subscriptions in mark mode", () => {
  const mutation = gql`
    mutation ($size: Int) {
      updateUser {
        id
        ...UserAvatar
      }
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `;

  const subscription = gql`
    subscription ($size: Int) {
      userUpdated {
        id
        ...UserAvatar
      }
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `;

  expect(
    removeMaskedFragmentSpreads(mutation, { mode: "mark" })
  ).toMatchDocument(gql`
    mutation ($size: Int) {
      updateUser {
        id
        ...UserAvatar @_apollo(mask: true)
      }
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `);

  expect(
    removeMaskedFragmentSpreads(subscription, { mode: "mark" })
  ).toMatchDocument(gql`
    subscription ($size: Int) {
      userUpdated {
        id
        ...UserAvatar @_apollo(mask: true)
      }
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `);
});

test("marks masked fragment spreads to fragments whose earlier nested fragment spread uses operation variables in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      user {
        id
        ...UserCard
      }
    }

    fragment UserCard on User {
      ...UserAvatar
      ...UserName
    }

    fragment UserAvatar on User {
      avatar(size: $size)
    }

    fragment UserName on User {
      name
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($size: Int) {
        user {
          id
          ...UserCard @_apollo(mask: true)
        }
      }

      fragment UserCard on User {
        ...UserAvatar @_apollo(mask: true)
      }

      fragment UserAvatar on User {
        avatar(size: $size)
      }

      fragment UserName on User {
        name
      }
    `
  );
});

test("checks each fragment for variables once in mark mode when many fragments spread the same fragments", () => {
  // Each level spreads both fragments of the level below, so the number of
  // paths from the top fragment to a bottom fragment doubles with each level.
  const depth = 10;
  const levels = Array.from({ length: depth }, (_, i) => i);

  const query = parse(`
    query {
      user {
        id
        ...Level0A
      }
    }

    ${levels
      .map(
        (i) => `
          fragment Level${i}A on User {
            a${i}: name
            ...Level${i + 1}A
            ...Level${i + 1}B
          }

          fragment Level${i}B on User {
            b${i}: name
            ...Level${i + 1}A
            ...Level${i + 1}B
          }
        `
      )
      .join("\n")}

    fragment Level${depth}A on User {
      name
    }

    fragment Level${depth}B on User {
      name
    }
  `);

  const bottomFragment = query.definitions.find(
    (definition): definition is FragmentDefinitionNode =>
      definition.kind === Kind.FRAGMENT_DEFINITION &&
      definition.name.value === `Level${depth}A`
  );
  invariant(bottomFragment, "Could not find bottom fragment");

  let selectionSetReads = 0;
  const { selectionSet } = bottomFragment;
  Object.defineProperty(bottomFragment, "selectionSet", {
    enumerable: true,
    get() {
      selectionSetReads++;
      return selectionSet;
    },
  });

  removeMaskedFragmentSpreads(query, { mode: "mark" });

  // Without memoization, the bottom fragment is walked once for every path
  // to it (2 ** depth times).
  expect(selectionSetReads).toBeLessThanOrEqual(2);
});
