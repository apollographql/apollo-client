import {
  disableFragmentWarnings,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import {
  equalByQuery,
  getFragmentQueryDocument,
} from "@apollo/client/utilities/internal";

disableFragmentWarnings();
enableExperimentalFragmentVariables();

test("uses root fragment variables for @include in the root fragment", () => {
  const query = getFragmentQueryDocument(gql`
    fragment UserCard($showName: Boolean!) on User {
      id
      name @include(if: $showName)
    }
  `);

  const a = { data: { __typename: "User", id: 1, name: "Alice" } };
  const b = { data: { __typename: "User", id: 1, name: "Bob" } };

  expect(equalByQuery(query, a, b, {}, { showName: false })).toBe(true);
  expect(equalByQuery(query, a, b, {}, { showName: true })).toBe(false);
});

test("uses root fragment variables instead of operation variables for the root fragment scope", () => {
  const query = getFragmentQueryDocument(gql`
    fragment UserCard($showName: Boolean!) on User {
      id
      name @include(if: $showName)
    }
  `);

  const a = { data: { __typename: "User", id: 1, name: "Alice" } };
  const b = { data: { __typename: "User", id: 1, name: "Bob" } };

  expect(
    equalByQuery(query, a, b, { showName: true }, { showName: false })
  ).toBe(true);
  expect(
    equalByQuery(query, a, b, { showName: false }, { showName: true })
  ).toBe(false);
});

test("uses variables as the root fragment scope when root fragment variables are not provided", () => {
  const query = getFragmentQueryDocument(gql`
    fragment UserCard($showName: Boolean!) on User {
      id
      name @include(if: $showName)
    }
  `);

  const a = { data: { __typename: "User", id: 1, name: "Alice" } };
  const b = { data: { __typename: "User", id: 1, name: "Bob" } };

  expect(equalByQuery(query, a, b, { showName: false })).toBe(true);
  expect(equalByQuery(query, a, b, { showName: true })).toBe(false);
});

test("uses the default value of a root fragment variable that is not provided", () => {
  const query = getFragmentQueryDocument(gql`
    fragment UserCard($showName: Boolean! = false) on User {
      id
      name @include(if: $showName)
    }
  `);

  const a = { data: { __typename: "User", id: 1, name: "Alice" } };
  const b = { data: { __typename: "User", id: 1, name: "Bob" } };

  expect(equalByQuery(query, a, b, {}, {})).toBe(true);
  expect(equalByQuery(query, a, b, {}, { showName: true })).toBe(false);
});

test("passes root fragment variables as arguments to a nested fragment", () => {
  const query = getFragmentQueryDocument(
    gql`
      fragment UserName($show: Boolean!) on User {
        name @include(if: $show)
      }

      fragment UserCard($showName: Boolean!) on User {
        id
        ...UserName(show: $showName)
      }
    `,
    "UserCard"
  );

  const a = { data: { __typename: "User", id: 1, name: "Alice" } };
  const b = { data: { __typename: "User", id: 1, name: "Bob" } };

  expect(equalByQuery(query, a, b, {}, { showName: false })).toBe(true);
  expect(equalByQuery(query, a, b, {}, { showName: true })).toBe(false);
});

test("uses literal arguments passed to a nested fragment", () => {
  const query = getFragmentQueryDocument(
    gql`
      fragment UserName($show: Boolean!) on User {
        name @include(if: $show)
      }

      fragment UserCard on User {
        id
        ...UserName(show: false)
      }
    `,
    "UserCard"
  );

  const a = { data: { __typename: "User", id: 1, name: "Alice" } };
  const b = { data: { __typename: "User", id: 1, name: "Bob" } };

  expect(equalByQuery(query, a, b, { show: true })).toBe(true);
});

test("uses operation variables in a nested fragment that declares no variables", () => {
  const query = getFragmentQueryDocument(
    gql`
      fragment UserName on User {
        name @include(if: $showName)
      }

      fragment UserCard($showId: Boolean!) on User {
        id @include(if: $showId)
        ...UserName
      }
    `,
    "UserCard"
  );

  const a = { data: { __typename: "User", id: 1, name: "Alice" } };
  const b = { data: { __typename: "User", id: 1, name: "Bob" } };

  expect(equalByQuery(query, a, b, { showName: false }, { showId: true })).toBe(
    true
  );
  expect(equalByQuery(query, a, b, { showName: true }, { showId: true })).toBe(
    false
  );
});

test("does not use root fragment variables in a nested fragment that declares no variables", () => {
  const query = getFragmentQueryDocument(
    gql`
      fragment UserName on User {
        name @include(if: $showName)
      }

      fragment UserCard($showName: Boolean!) on User {
        id
        ...UserName
      }
    `,
    "UserCard"
  );

  const a = { data: { __typename: "User", id: 1, name: "Alice" } };
  const b = { data: { __typename: "User", id: 1, name: "Bob" } };

  expect(
    equalByQuery(query, a, b, { showName: false }, { showName: true })
  ).toBe(true);
  expect(
    equalByQuery(query, a, b, { showName: true }, { showName: false })
  ).toBe(false);
});

test("shadows an operation variable with a nested fragment argument of the same name", () => {
  const query = getFragmentQueryDocument(
    gql`
      fragment UserName($showName: Boolean!) on User {
        name @include(if: $showName)
      }

      fragment UserCard on User {
        id
        ...UserName(showName: false)
      }
    `,
    "UserCard"
  );

  const a = { data: { __typename: "User", id: 1, name: "Alice" } };
  const b = { data: { __typename: "User", id: 1, name: "Bob" } };

  expect(equalByQuery(query, a, b, { showName: true })).toBe(true);
});

test("uses different fragment arguments for each spread of the same fragment", () => {
  const query = getFragmentQueryDocument(
    gql`
      fragment UserName($show: Boolean!) on User {
        name @include(if: $show)
      }

      fragment UserCard on User {
        id
        author {
          ...UserName(show: true)
        }
        reviewer {
          ...UserName(show: false)
        }
      }
    `,
    "UserCard"
  );

  const base = { __typename: "User", id: 1 };

  expect(
    equalByQuery(
      query,
      {
        data: {
          ...base,
          author: { __typename: "User", name: "Alice" },
          reviewer: { __typename: "User", name: "Bob" },
        },
      },
      {
        data: {
          ...base,
          author: { __typename: "User", name: "Alice" },
          reviewer: { __typename: "User", name: "Carol" },
        },
      }
    )
  ).toBe(true);
  expect(
    equalByQuery(
      query,
      {
        data: {
          ...base,
          author: { __typename: "User", name: "Alice" },
          reviewer: { __typename: "User", name: "Bob" },
        },
      },
      {
        data: {
          ...base,
          author: { __typename: "User", name: "Carol" },
          reviewer: { __typename: "User", name: "Bob" },
        },
      }
    )
  ).toBe(false);
});
