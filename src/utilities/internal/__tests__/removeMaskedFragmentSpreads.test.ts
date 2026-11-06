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
