import {
  disableFragmentWarnings,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { getFragmentQueryDocument } from "@apollo/client/utilities/internal";

disableFragmentWarnings();
enableExperimentalFragmentVariables();

test("passes a variable as an argument to the root fragment spread for each fragment variable", () => {
  const document = getFragmentQueryDocument(gql`
    fragment UserCard($size: Int, $format: String) on User {
      id
      avatar(size: $size, format: $format)
    }
  `);

  expect(document).toMatchDocument(gql`
    {
      ...UserCard(size: $size, format: $format)
    }

    fragment UserCard($size: Int, $format: String) on User {
      id
      avatar(size: $size, format: $format)
    }
  `);
});

test("only passes arguments for fragment variables and not for operation variables used in the fragment", () => {
  const document = getFragmentQueryDocument(gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size, format: $format)
    }
  `);

  expect(document).toMatchDocument(gql`
    {
      ...UserCard(size: $size)
    }

    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size, format: $format)
    }
  `);
});

test("does not pass arguments to the root fragment spread when the fragment declares no variables", () => {
  const document = getFragmentQueryDocument(gql`
    fragment UserCard on User {
      id
      avatar(size: $size)
    }
  `);

  expect(document).toMatchDocument(gql`
    {
      ...UserCard
    }

    fragment UserCard on User {
      id
      avatar(size: $size)
    }
  `);
});

test("passes variables for fragment variables with default values", () => {
  const document = getFragmentQueryDocument(gql`
    fragment UserCard($size: Int = 48, $format: String! = "png") on User {
      id
      avatar(size: $size, format: $format)
    }
  `);

  expect(document).toMatchDocument(gql`
    {
      ...UserCard(size: $size, format: $format)
    }

    fragment UserCard($size: Int = 48, $format: String! = "png") on User {
      id
      avatar(size: $size, format: $format)
    }
  `);
});

test("passes variables for non-null and list fragment variables", () => {
  const document = getFragmentQueryDocument(gql`
    fragment UserCard($size: Int!, $ids: [ID!]!, $tags: [String]) on User {
      id
      avatar(size: $size)
      friends(ids: $ids, tags: $tags) {
        id
      }
    }
  `);

  expect(document).toMatchDocument(gql`
    {
      ...UserCard(size: $size, ids: $ids, tags: $tags)
    }

    fragment UserCard($size: Int!, $ids: [ID!]!, $tags: [String]) on User {
      id
      avatar(size: $size)
      friends(ids: $ids, tags: $tags) {
        id
      }
    }
  `);
});

test("passes variables for fragment variables that are not used in the fragment", () => {
  const document = getFragmentQueryDocument(gql`
    fragment UserCard($size: Int) on User {
      id
    }
  `);

  expect(document).toMatchDocument(gql`
    {
      ...UserCard(size: $size)
    }

    fragment UserCard($size: Int) on User {
      id
    }
  `);
});

test("only passes the variables of the fragment selected by fragmentName", () => {
  const document = getFragmentQueryDocument(
    gql`
      fragment UserAvatar($avatarSize: Int) on User {
        avatar(size: $avatarSize)
      }

      fragment UserCard($size: Int) on User {
        id
        ...UserAvatar(avatarSize: $size)
      }
    `,
    "UserCard"
  );

  expect(document).toMatchDocument(gql`
    {
      ...UserCard(size: $size)
    }

    fragment UserAvatar($avatarSize: Int) on User {
      avatar(size: $avatarSize)
    }

    fragment UserCard($size: Int) on User {
      id
      ...UserAvatar(avatarSize: $size)
    }
  `);
});

test("passes the variables of a nested fragment selected by fragmentName", () => {
  const document = getFragmentQueryDocument(
    gql`
      fragment UserAvatar($avatarSize: Int) on User {
        avatar(size: $avatarSize)
      }

      fragment UserCard($size: Int) on User {
        id
        ...UserAvatar(avatarSize: $size)
      }
    `,
    "UserAvatar"
  );

  expect(document).toMatchDocument(gql`
    {
      ...UserAvatar(avatarSize: $avatarSize)
    }

    fragment UserAvatar($avatarSize: Int) on User {
      avatar(size: $avatarSize)
    }

    fragment UserCard($size: Int) on User {
      id
      ...UserAvatar(avatarSize: $size)
    }
  `);
});

test("does not pass arguments when the fragment selected by fragmentName declares no variables", () => {
  const document = getFragmentQueryDocument(
    gql`
      fragment UserAvatar($avatarSize: Int) on User {
        avatar(size: $avatarSize)
      }

      fragment UserCard on User {
        id
        ...UserAvatar(avatarSize: 96)
      }
    `,
    "UserCard"
  );

  expect(document).toMatchDocument(gql`
    {
      ...UserCard
    }

    fragment UserAvatar($avatarSize: Int) on User {
      avatar(size: $avatarSize)
    }

    fragment UserCard on User {
      id
      ...UserAvatar(avatarSize: 96)
    }
  `);
});
