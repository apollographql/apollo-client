import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("keeps operation variables used in fragments that declare the same variable", () => {
  const query = gql`
    query Team($size: Int!) {
      lead {
        id
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
      local @client
    }
  `;

  const doc = removeDirectivesFromDocument(
    [{ name: "client", remove: true }],
    query
  );

  expect(doc).toMatchDocument(gql`
    query Team($size: Int!) {
      lead {
        id
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `);
});

test("removes operation variables when the only field using them in a fragment that declares the same variable is removed", () => {
  const query = gql`
    query Team($size: Int!) {
      lead {
        id
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size) @client
    }
  `;

  const doc = removeDirectivesFromDocument(
    [{ name: "client", remove: true }],
    query
  );

  expect(doc).toMatchDocument(gql`
    query Team {
      lead {
        id
        ...UserCard
      }
    }

    fragment UserCard on User {
      id
    }
  `);
});

test("keeps operation variables used in nested fragments that declare the same variable", () => {
  const query = gql`
    query Team($size: Int!) {
      lead {
        id
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      id
      local @client
      ...UserAvatar
    }

    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const doc = removeDirectivesFromDocument(
    [{ name: "client", remove: true }],
    query
  );

  expect(doc).toMatchDocument(gql`
    query Team($size: Int!) {
      lead {
        id
        ...UserCard
      }
    }

    fragment UserCard on User {
      id
      ...UserAvatar
    }

    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }
  `);
});
