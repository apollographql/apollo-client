import { mask } from "../masking.js";
import { gql } from "../index.js";

test("strips top-level fragment data from query", () => {
  const query = gql`
    query {
      foo
      ...QueryFields
    }

    fragment QueryFields on Query {
      bar
    }
  `;

  const { data } = mask({ foo: true, bar: true }, query);

  expect(data).toEqual({ foo: true });
});

test("strips fragment data from nested object", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      name
    }
  `;

  const { data } = mask(
    { user: { __typename: "User", id: 1, name: "Test User" } },
    query
  );

  expect(data).toEqual({ user: { __typename: "User", id: 1 } });
});

test("strips fragment data from arrays", () => {
  const query = gql`
    query {
      users {
        __typename
        id
        ...UserFields
      }
    }

    fragment UserFields on User {
      name
    }
  `;

  const { data } = mask(
    {
      users: [
        { __typename: "User", id: 1, name: "Test User 1" },
        { __typename: "User", id: 2, name: "Test User 2" },
      ],
    },
    query
  );

  expect(data).toEqual({
    users: [
      { __typename: "User", id: 1 },
      { __typename: "User", id: 2 },
    ],
  });
});

test("strips multiple fragments in the same selection set", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        ...UserProfileFields
        ...UserAvatarFields
      }
    }

    fragment UserProfileFields on User {
      age
    }

    fragment UserAvatarFields on User {
      avatarUrl
    }
  `;

  const { data } = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        age: 30,
        avatarUrl: "https://example.com/avatar.jpg",
      },
    },
    query
  );

  expect(data).toEqual({
    user: { __typename: "User", id: 1 },
  });
});

test("strips multiple fragments across different selection sets", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        ...UserFields
      }
      post {
        __typename
        id
        ...PostFields
      }
    }

    fragment UserFields on User {
      name
    }

    fragment PostFields on Post {
      title
    }
  `;

  const { data } = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        name: "test user",
      },
      post: {
        __typename: "Post",
        id: 1,
        title: "Test Post",
      },
    },
    query
  );

  expect(data).toEqual({
    user: { __typename: "User", id: 1 },
    post: { __typename: "Post", id: 1 },
  });
});

test("leaves overlapping fields in query", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        birthdate
        ...UserProfileFields
      }
    }

    fragment UserProfileFields on User {
      birthdate
      name
    }
  `;

  const { data } = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        birthdate: "1990-01-01",
        name: "Test User",
      },
    },
    query
  );

  expect(data).toEqual({
    user: { __typename: "User", id: 1, birthdate: "1990-01-01" },
  });
});

test("does not strip inline fragments", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        ... @defer {
          name
        }
      }
      profile {
        __typename
        ... on UserProfile {
          avatarUrl
        }
      }
    }
  `;

  const { data } = mask(
    {
      user: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
      profile: {
        __typename: "UserProfile",
        avatarUrl: "https://example.com/avatar.jpg",
      },
    },
    query
  );

  expect(data).toEqual({
    user: {
      __typename: "User",
      id: 1,
      name: "Test User",
    },
    profile: {
      __typename: "UserProfile",
      avatarUrl: "https://example.com/avatar.jpg",
    },
  });
});

test.skip("does nothing if there are no fragments to mask", () => {
  const query = gql`
    query {
      user {
        id
        name
      }
    }
  `;

  const originalData = {
    user: {
      __typename: "User",
      id: 1,
      name: "Test User",
    },
  };

  const { data } = mask(originalData, query);

  expect(data).toEqual({
    user: { __typename: "User", id: 1, name: "Test User" },
  });
});

test.skip("maintains referential equality on subtrees that did not change", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        ...UserFields
      }
      post {
        __typename
        id
        title
      }
    }

    fragment UserFields on User {
      name
    }
  `;

  const user = { __typename: "User", id: 1, name: "Test User" };
  const post = { __typename: "Post", id: 1, title: "Test Post" };
  const originalData = { user, post };

  const { data } = mask(originalData, query);

  expect(data).not.toBe(originalData);
  expect(data.user).not.toBe(user);
  expect(data.post).toBe(post);
});

test.skip("maintains referential equality the entire result if there are no fragments", () => {
  const query = gql`
    query {
      user {
        __typename
        id
        name
      }
    }
  `;

  const originalData = {
    user: {
      __typename: "User",
      id: 1,
      name: "Test User",
    },
  };

  const { data } = mask(originalData, query);

  expect(data).toBe(originalData);
});
