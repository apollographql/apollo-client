import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { removeMaskedFragmentSpreads } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("marks masked fragment spreads to fragments that declare variables in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      user {
        id
        ...UserAvatar
      }
    }

    fragment UserAvatar($size: Int) on User {
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

      fragment UserAvatar($size: Int) on User {
        avatar(size: $size)
      }
    `
  );
});

test("marks masked fragment spreads to fragments that declare unused variables in mark mode", () => {
  const query = gql`
    query ($size: Int) {
      user {
        id
        ...UserAvatar
      }
    }

    fragment UserAvatar($size: Int) on User {
      avatar
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

      fragment UserAvatar($size: Int) on User {
        avatar
      }
    `
  );
});
