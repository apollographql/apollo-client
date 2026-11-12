import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { removeMaskedFragmentSpreads } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("removes masked fragment spreads with fragment arguments", () => {
  const query = gql`
    query {
      user {
        id
        ...UserFields(size: 96)
      }
    }

    fragment UserFields($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query)).toMatchDocument(gql`
    query {
      user {
        id
      }
    }

    fragment UserFields($size: Int) on User {
      avatar(size: $size)
    }
  `);
});

test("marks masked fragment spreads with fragment arguments in mark mode", () => {
  const query = gql`
    query {
      user {
        id
        ...UserFields(size: 96)
      }
    }

    fragment UserFields($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query {
        user {
          id
          ...UserFields(size: 96) @_apollo(mask: true)
        }
      }

      fragment UserFields($size: Int) on User {
        avatar(size: $size)
      }
    `
  );
});

test("marks masked fragment spreads that pass operation variables as fragment arguments in mark mode", () => {
  const query = gql`
    query ($avatarSize: Int) {
      user {
        id
        ...UserFields(size: $avatarSize)
      }
    }

    fragment UserFields($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query ($avatarSize: Int) {
        user {
          id
          ...UserFields(size: $avatarSize) @_apollo(mask: true)
        }
      }

      fragment UserFields($size: Int) on User {
        avatar(size: $size)
      }
    `
  );
});

test("marks masked fragment spreads that use fragment argument defaults in mark mode", () => {
  const query = gql`
    query {
      user {
        id
        ...UserFields
      }
    }

    fragment UserFields($size: Int = 96) on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query {
        user {
          id
          ...UserFields @_apollo(mask: true)
        }
      }

      fragment UserFields($size: Int = 96) on User {
        avatar(size: $size)
      }
    `
  );
});

test("removes masked fragment spreads without fragment arguments in mark mode", () => {
  const query = gql`
    query {
      user {
        id
        ...UserFields
        ...UserAvatar(size: 96)
      }
    }

    fragment UserFields on User {
      name
    }

    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query {
        user {
          id
          ...UserAvatar(size: 96) @_apollo(mask: true)
        }
      }

      fragment UserFields on User {
        name
      }

      fragment UserAvatar($size: Int) on User {
        avatar(size: $size)
      }
    `
  );
});

test("marks masked fragment spreads with fragment arguments inside fragment definitions in mark mode", () => {
  const query = gql`
    query {
      user {
        id
        ...UserFields @unmask
      }
    }

    fragment UserFields on User {
      name
      ...UserAvatar(size: 96)
      ...UserBadge
    }

    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }

    fragment UserBadge on User {
      badge
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query {
        user {
          id
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        name
        ...UserAvatar(size: 96) @_apollo(mask: true)
      }

      fragment UserAvatar($size: Int) on User {
        avatar(size: $size)
      }

      fragment UserBadge on User {
        badge
      }
    `
  );
});

test("does not mark fragment spreads with @unmask in mark mode", () => {
  const query = gql`
    query {
      user {
        id
        ...UserFields(size: 96) @unmask
        ...UserBadge @unmask
      }
    }

    fragment UserFields($size: Int) on User {
      avatar(size: $size)
    }

    fragment UserBadge on User {
      badge
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    query
  );
});

test("removes masked fragment spreads with fragment arguments to fragments missing from the document in mark mode", () => {
  const query = gql`
    query {
      user {
        id
        ...UserAvatar(size: 96)
        ...toString(size: 96)
        ...constructor(size: 96)
      }
    }
  `;

  expect(removeMaskedFragmentSpreads(query, { mode: "mark" })).toMatchDocument(
    gql`
      query {
        user {
          id
        }
      }
    `
  );
});
