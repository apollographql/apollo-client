import { gql } from "@apollo/client";
import { removeMaskedFragmentSpreads } from "@apollo/client/utilities/internal";

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
