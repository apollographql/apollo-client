import { gql } from "graphql-tag";

import { execute } from "@apollo/client/link/core";
import type { MockedResponse } from "@apollo/client/testing";
import { MockLink, realisticDelay } from "@apollo/client/testing";
import {
  enableFakeTimers,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { InvariantError } from "@apollo/client/utilities/invariant";

// This isn't a public API and won't be exposed
// eslint-disable-next-line local-rules/no-relative-imports
import { stringifyMockedResponse } from "../mockLink.js";

/*
We've chosen this value as the MAXIMUM_DELAY since values that don't fit into a 32-bit signed int cause setTimeout to fire immediately
*/
const MAXIMUM_DELAY = 0x7f_ff_ff_ff;

const query = gql`
  query A {
    a
  }
`;

test("should not require a result or error when delay equals Infinity", async () => {
  using _fakeTimers = enableFakeTimers();

  const mockLink = new MockLink([
    {
      request: {
        query,
      },
      delay: Infinity,
    },
  ]);

  const observable = execute(mockLink, { query });

  const subscription = observable.subscribe(
    () => fail("onNext was called"),
    () => fail("onError was called"),
    () => fail("onComplete was called")
  );
  jest.advanceTimersByTime(MAXIMUM_DELAY);
  subscription.unsubscribe();
});

test("should require result or error when delay is just large", async () => {
  const invalidResponse = { request: { query }, delay: MAXIMUM_DELAY };
  const expectedError = new Error(
    `Mocked response should contain either \`result\`, \`error\` or a \`delay\` of \`Infinity\`:\n${stringifyMockedResponse(
      invalidResponse
    )}`
  );

  {
    const link = new MockLink([invalidResponse]);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(expectedError);
  }

  {
    const link = new MockLink([]);
    link.addMockedResponse(invalidResponse);

    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(expectedError);
  }
});

test("waits to return result based on static delay", async () => {
  const query = gql`
    query {
      a
    }
  `;
  const link = new MockLink([
    {
      request: { query },
      result: { data: { a: "a" } },
      delay: 100,
    },
  ]);

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).not.toEmitAnything({ timeout: 95 });
  await expect(stream).toEmitNext({ timeout: 6 });
  await expect(stream).toComplete();
});

test("waits to return result based on delay returned from callback function", async () => {
  const query = gql`
    query {
      a
    }
  `;
  const delay = jest.fn().mockReturnValue(100);
  const link = new MockLink([
    {
      request: { query },
      result: { data: { a: "a" } },
      delay,
    },
  ]);

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).not.toEmitAnything({ timeout: 95 });
  await expect(stream).toEmitNext({ timeout: 6 });
  await expect(stream).toComplete();

  expect(delay).toHaveBeenCalledTimes(1);
  expect(delay).toHaveBeenCalledWith(expect.objectContaining({ query }));
});

test("can set min/max for realisticDelay", async () => {
  const query = gql`
    query {
      a
    }
  `;
  const link = new MockLink([
    {
      request: { query },
      result: { data: { a: "a" } },
      delay: realisticDelay({ min: 50, max: 100 }),
    },
  ]);

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).not.toEmitAnything({ timeout: 45 });
  await expect(stream).toEmitNext({ timeout: 56 });
  await expect(stream).toComplete();
});

test("returns matched mock", async () => {
  const query = gql`
    query {
      a
    }
  `;
  const link = new MockLink([
    { request: { query }, result: { data: { a: "a" } } },
    {
      request: {
        query: gql`
          query {
            b
          }
        `,
      },
      result: { data: { b: "b" } },
    },
  ]);

  const stream = new ObservableStream(execute(link, { query }));

  expect(stream).toEmitTypedValue({ data: { a: "a" } });
  expect(stream).toComplete();
});

test("allows default static delay to be defined for all mocks", async () => {
  const aQuery = gql`
    query {
      a
    }
  `;
  const bQuery = gql`
    query {
      b
    }
  `;
  const link = new MockLink(
    [
      {
        request: { query: aQuery },
        result: { data: { a: "a" } },
      },
      {
        request: { query: bQuery },
        result: { data: { a: "b" } },
      },
    ],
    { defaultOptions: { delay: 50 } }
  );

  {
    const stream = new ObservableStream(execute(link, { query: aQuery }));

    await expect(stream).not.toEmitAnything({ timeout: 45 });
    await expect(stream).toEmitNext({ timeout: 6 });
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query: bQuery }));

    await expect(stream).not.toEmitAnything({ timeout: 45 });
    await expect(stream).toEmitNext({ timeout: 6 });
    await expect(stream).toComplete();
  }
});

test("allows default dynamic delay to be defined for all mocks", async () => {
  const aQuery = gql`
    query A {
      a
    }
  `;
  const bQuery = gql`
    query B {
      b
    }
  `;
  const link = new MockLink(
    [
      {
        request: { query: aQuery },
        result: { data: { a: "a" } },
      },
      {
        request: { query: bQuery },
        result: { data: { a: "b" } },
      },
    ],
    {
      defaultOptions: {
        delay: (operation) => (operation.operationName === "A" ? 50 : 20),
      },
    }
  );

  {
    const stream = new ObservableStream(execute(link, { query: aQuery }));

    await expect(stream).not.toEmitAnything({ timeout: 45 });
    await expect(stream).toEmitNext({ timeout: 6 });
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query: bQuery }));

    await expect(stream).not.toEmitAnything({ timeout: 15 });
    await expect(stream).toEmitNext({ timeout: 6 });
    await expect(stream).toComplete();
  }
});

test("prefers configured delay over default delay", async () => {
  const query = gql`
    query {
      a
    }
  `;
  const link = new MockLink(
    [
      {
        request: { query },
        result: { data: { a: "a" } },
        delay: 20,
      },
      {
        request: { query },
        result: { data: { a: "a" } },
      },
    ],
    { defaultOptions: { delay: 50 } }
  );

  {
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitNext({ timeout: 25 });
    await expect(stream).toComplete();
  }

  // This uses the default delay
  {
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).not.toEmitAnything({ timeout: 45 });
    await expect(stream).toEmitNext({ timeout: 6 });
    await expect(stream).toComplete();
  }
});

test("uses realistic delay by default", async () => {
  const query = gql`
    query A {
      a
    }
  `;
  const link = new MockLink([
    { request: { query }, result: { data: { a: "a" } } },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query }));

    // The default min is 20 so we don't expect to see anything before then
    await expect(stream).not.toEmitAnything({ timeout: 15 });
    // The default max is 50 so we should definitely have a result now
    await expect(stream).toEmitNext({ timeout: 36 });
    await expect(stream).toComplete();
  }
});

test("matches like mocks sequentially", async () => {
  const query = gql`
    query {
      a
    }
  `;
  const link = new MockLink([
    { request: { query }, result: { data: { a: "a" } } },
    { request: { query }, result: { data: { a: "b" } } },
    { request: { query }, result: { data: { a: "c" } } },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query }));

    expect(stream).toEmitTypedValue({ data: { a: "a" } });
    expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query }));

    expect(stream).toEmitTypedValue({ data: { a: "b" } });
    expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query }));

    expect(stream).toEmitTypedValue({ data: { a: "c" } });
    expect(stream).toComplete();
  }
});

test("matches out-of-order queries", async () => {
  const aQuery = gql`
    query {
      a
    }
  `;
  const bQuery = gql`
    query {
      b
    }
  `;
  const link = new MockLink([
    { request: { query: aQuery }, result: { data: { a: "a" } } },
    { request: { query: bQuery }, result: { data: { b: "b" } } },
    { request: { query: aQuery }, result: { data: { a: "c" } } },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query: aQuery }));

    expect(stream).toEmitTypedValue({ data: { a: "a" } });
    expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query: aQuery }));

    expect(stream).toEmitTypedValue({ data: { a: "c" } });
    expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query: bQuery }));

    expect(stream).toEmitTypedValue({ data: { b: "b" } });
    expect(stream).toComplete();
  }
});

test("returns error when no mock matches request", async () => {
  const query = gql`
    query {
      a
    }
  `;

  {
    const link = new MockLink([], { showWarnings: false });
    const stream = new ObservableStream(execute(link, { query }));

    const error = await stream.takeError();
    expect(error.message).toMatchSnapshot();
  }

  {
    const link = new MockLink(
      [
        {
          request: {
            query: gql`
              query {
                b
              }
            `,
          },
          result: { data: { b: "b" } },
        },
      ],
      { showWarnings: false }
    );
    const stream = new ObservableStream(execute(link, { query }));

    const error = await stream.takeError();
    expect(error.message).toMatchSnapshot();
  }
});

test("consumes matched mock", async () => {
  const query = gql`
    query {
      a
    }
  `;
  const link = new MockLink(
    [
      {
        request: { query },
        result: { data: { a: "a" } },
      },
    ],
    { showWarnings: false }
  );

  {
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({ data: { a: "a" } });
  }

  {
    const stream = new ObservableStream(execute(link, { query }));

    const error = await stream.takeError();
    expect(error.message).toMatchSnapshot();
  }
});

test("returns matched mock with variables", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `;
  const link = new MockLink([
    {
      request: { query, variables: { id: 1 } },
      result: { data: { user: { __typename: "User", name: "User 1" } } },
    },
    {
      request: { query, variables: { id: 2 } },
      result: { data: { user: { __typename: "User", name: "User 2" } } },
    },
  ]);

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 2 } })
  );

  expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", name: "User 2" } },
  });
  expect(stream).toComplete();
});

test("matches variables with undefined values", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `;
  const link = new MockLink([
    {
      request: { query, variables: { id: 1, foo: undefined } },
      result: { data: { user: { __typename: "User", name: "User 1" } } },
    },
  ]);

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 1 } })
  );

  expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", name: "User 1" } },
  });
  expect(stream).toComplete();
});

test("should fill in default variables if they are missing in mocked requests", async () => {
  const query = gql`
    query GetTodo($done: Boolean = true, $user: String!) {
      todo(user: $user, done: $done) {
        id
      }
    }
  `;
  const mocks = [
    {
      // default should get filled in here
      request: { query, variables: { user: "Tim" } },
      result: {
        data: { todo: { id: 1 } },
      },
    },
    {
      // we provide our own `done`, so it should not get filled in
      request: { query, variables: { user: "Tim", done: false } },
      result: {
        data: { todo: { id: 2 } },
      },
    },
    {
      // one more that has a different user variable and should never match
      request: { query, variables: { user: "Tom" } },
      result: {
        data: { todo: { id: 2 } },
      },
    },
  ];

  // Apollo Client will always fill in default values for missing variables
  // in the operation before calling the Link, so we have to do the same here
  // when we call `execute`
  const defaults = { done: true };
  const link = new MockLink(mocks, { showWarnings: false });
  {
    // Non-optional variable is missing, should not match.
    const stream = new ObservableStream(
      execute(link, { query, variables: { ...defaults } })
    );
    await expect(stream).toEmitError();
  }
  {
    // Execute called incorrectly without a default variable filled in.
    // This will never happen in Apollo Client since AC always fills these
    // before calling `execute`, so it's okay if it results in a "no match"
    // scenario here.
    const stream = new ObservableStream(
      execute(link, { query, variables: { user: "Tim" } })
    );
    await expect(stream).toEmitError();
  }
  {
    // Expect default value to be filled in the mock request.
    const stream = new ObservableStream(
      execute(link, { query, variables: { ...defaults, user: "Tim" } })
    );
    await expect(stream).toEmitTypedValue({ data: { todo: { id: 1 } } });
  }
  {
    // Test that defaults don't overwrite explicitly different values in a mock request.
    const stream = new ObservableStream(
      execute(link, {
        query,
        variables: { ...defaults, user: "Tim", done: false },
      })
    );
    await expect(stream).toEmitTypedValue({ data: { todo: { id: 2 } } });
  }
});

test("does not show variables in error message if none configured", async () => {
  const query = gql`
    query {
      a
    }
  `;
  const link = new MockLink(
    [
      {
        request: { query },
        result: { data: { user: { __typename: "User", name: "User 1" } } },
      },
    ],
    { showWarnings: false }
  );

  const stream = new ObservableStream(
    execute(link, {
      query: gql`
        query {
          b
        }
      `,
    })
  );

  const error = await stream.takeError();
  expect(error.message).toMatchSnapshot();
});

test("shows all configured variables for queries that did not match request", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `;
  const link = new MockLink(
    [
      {
        request: { query, variables: { id: 1 } },
        result: { data: { user: { __typename: "User", name: "User 1" } } },
      },
      {
        request: { query, variables: { id: 2 } },
        result: { data: { user: { __typename: "User", name: "User 2" } } },
      },
      {
        request: { query, variables: { id: 3 } },
        result: { data: { user: { __typename: "User", name: "User 3" } } },
      },
    ],
    { showWarnings: false }
  );

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 4 } })
  );

  const error = await stream.takeError();
  expect(error.message).toMatchSnapshot();
});

test("shows <undefined> for mocks with no configured variables", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `;
  const link = new MockLink(
    [
      {
        request: { query },
        result: { data: { user: { __typename: "User", name: "User 1" } } },
      },
      {
        request: { query, variables: { id: 2 } },
        result: { data: { user: { __typename: "User", name: "User 2" } } },
      },
    ],
    { showWarnings: false }
  );

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 3 } })
  );

  const error = await stream.takeError();
  expect(error.message).toMatchSnapshot();
});

test("shows default variables from query in error message for mocks with no configured variables", async () => {
  const query = gql`
    query ($id: ID! = 1) {
      user(id: $id) {
        name
      }
    }
  `;
  const link = new MockLink(
    [
      {
        request: { query },
        result: { data: { user: { __typename: "User", name: "User 1" } } },
      },
      {
        request: { query, variables: { id: 2 } },
        result: { data: { user: { __typename: "User", name: "User 2" } } },
      },
    ],
    { showWarnings: false }
  );

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 3 } })
  );

  const error = await stream.takeError();
  expect(error.message).toMatchSnapshot();
});

test("shows empty object for variables when configured with empty vars", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `;
  const link = new MockLink(
    [
      {
        request: { query, variables: {} },
        result: { data: { user: { __typename: "User", name: "User 1" } } },
      },
      {
        request: { query, variables: { id: 2 } },
        result: { data: { user: { __typename: "User", name: "User 2" } } },
      },
    ],
    { showWarnings: false }
  );

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 3 } })
  );

  const error = await stream.takeError();
  expect(error.message).toMatchSnapshot();
});

test("throws error when a query is not provided", async () => {
  expect(
    () =>
      new MockLink([
        {
          // @ts-expect-error
          request: {},
          result: { data: null },
        },
      ])
  ).toThrow(/^Expecting a parsed GraphQL document/);
});

test("throws error when query is a plain string", async () => {
  expect(
    () =>
      new MockLink([
        {
          request: {
            // @ts-ignore
            query: `
              query {
                foo
              }
            `,
          },
          result: {
            data: null,
          },
        },
      ])
  ).toThrow(/^Expecting a parsed GraphQL document/);
});

test("throws error when given a client-only query", async () => {
  expect(
    () =>
      new MockLink([
        {
          request: {
            query: gql`
              query {
                foo @client
              }
            `,
          },
          result: {
            data: {
              foo: "never",
            },
          },
        },
      ])
  ).toThrow(
    new InvariantError(
      "Cannot mock a client-only query. Mocked responses should contain at least one non-client field."
    )
  );
});

test("throws error when passing maxUsageCount <= 0", async () => {
  expect(
    () =>
      new MockLink([
        {
          request: {
            query: gql`
              query {
                foo
              }
            `,
          },
          maxUsageCount: -1,
          result: {
            data: null,
          },
        },
      ])
  ).toThrow(
    new InvariantError(
      "Mocked response `maxUsageCount` must be greater than 0. Given -1"
    )
  );

  expect(
    () =>
      new MockLink([
        {
          request: {
            query: gql`
              query {
                foo
              }
            `,
          },
          maxUsageCount: 0,
          result: {
            data: null,
          },
        },
      ])
  ).toThrow(
    new InvariantError(
      "Mocked response `maxUsageCount` must be greater than 0. Given 0"
    )
  );
});

test("passes variables to the `variables` callback function", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `;

  const variables = { id: 1 };
  const variableMatcher = jest.fn().mockReturnValue(true);

  const link = new MockLink([
    {
      request: { query, variables: variableMatcher },
      result: { data: { user: { __typename: "User", name: "Test" } } },
    },
  ]);

  const stream = new ObservableStream(execute(link, { query, variables }));

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", name: "Test" } },
  });

  expect(variableMatcher).toHaveBeenCalledTimes(1);
  expect(variableMatcher).toHaveBeenCalledWith(variables);
});

test("uses mock when `variables` as callback returns true", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `;

  const link = new MockLink([
    {
      request: { query, variables: ({ id }) => id === 1 },
      result: { data: { user: { __typename: "User", name: "User 1" } } },
    },
    {
      request: { query, variables: ({ id }) => id === 2 },
      result: { data: { user: { __typename: "User", name: "User 2" } } },
    },
  ]);

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 2 } })
  );

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", name: "User 2" } },
  });
});

test("fails when variables returns false", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `;

  const link = new MockLink(
    [
      {
        request: { query, variables: () => false },
        result: { data: { user: { __typename: "User", name: "User 1" } } },
      },
    ],
    { showWarnings: false }
  );

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 1 } })
  );

  const error = await stream.takeError();
  expect(error.message).toMatchSnapshot();
});

test("removes @nonreactive directives from fields", async () => {
  const serverQuery = gql`
    query A {
      a
      b
      c
    }
  `;

  const link = new MockLink([
    {
      request: {
        query: gql`
          query A {
            a
            b
            c @nonreactive
          }
        `,
      },
      result: { data: { a: 1, b: 2, c: 3 } },
    },
    {
      request: {
        query: gql`
          query A {
            a
            b
            c
          }
        `,
      },
      result: { data: { a: 4, b: 5, c: 6 } },
    },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream).toEmitTypedValue({
      data: { a: 1, b: 2, c: 3 },
    });
  }

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream).toEmitTypedValue({
      data: { a: 4, b: 5, c: 6 },
    });
  }
});

test("removes @connection directives", async () => {
  const serverQuery = gql`
    query A {
      a
      b
      c
    }
  `;

  const link = new MockLink([
    {
      request: {
        query: gql`
          query A {
            a
            b
            c @connection(key: "test")
          }
        `,
      },
      result: { data: { a: 1, b: 2, c: 3 } },
    },
    {
      request: {
        query: gql`
          query A {
            a
            b
            c
          }
        `,
      },
      result: { data: { a: 4, b: 5, c: 6 } },
    },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream).toEmitTypedValue({
      data: { a: 1, b: 2, c: 3 },
    });
  }

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream).toEmitTypedValue({
      data: { a: 4, b: 5, c: 6 },
    });
  }
});

test("removes fields with @client directives", async () => {
  const serverQuery = gql`
    query A {
      a
      b
    }
  `;

  const link = new MockLink([
    {
      request: {
        query: gql`
          query A {
            a
            b
            c @client
          }
        `,
      },
      result: { data: { a: 1, b: 2 } },
    },
    {
      request: {
        query: gql`
          query A {
            a
            b
          }
        `,
      },
      result: { data: { a: 3, b: 4 } },
    },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream).toEmitTypedValue({ data: { a: 1, b: 2 } });
  }

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream).toEmitTypedValue({ data: { a: 3, b: 4 } });
  }
});

test("shows warning in console when a mock cannot be matched", async () => {
  using _ = spyOnConsole("warn");
  const query = gql`
    query {
      foo
    }
  `;

  const link = new MockLink([
    {
      request: {
        query: gql`
          query OtherQuery {
            otherQuery {
              id
            }
          }
        `,
      },
      result: { data: { otherQuery: { id: 1 } } },
    },
  ]);

  const stream = new ObservableStream(execute(link, { query }));
  await expect(stream).toEmitError();

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("No more mocked responses")
  );
});

test("silences console warning for unmatched mocks when `showWarnings` is `false`", async () => {
  using _ = spyOnConsole("warn");
  const query = gql`
    query {
      foo
    }
  `;

  const link = new MockLink(
    [
      {
        request: {
          query: gql`
            query OtherQuery {
              otherQuery {
                id
              }
            }
          `,
        },
        result: { data: { otherQuery: { id: 1 } } },
      },
    ],
    { showWarnings: false }
  );

  const stream = new ObservableStream(execute(link, { query }));
  await expect(stream).toEmitError();

  expect(console.warn).not.toHaveBeenCalled();
});

test("shows undefined and NaN in debug messages", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    query ($id: ID!, $filter: Boolean) {
      usersByTestId(id: $id, filter: $filter) {
        id
      }
    }
  `;

  const link = new MockLink([
    {
      request: { query, variables: { id: 1, filter: true } },
      // The actual response data makes no difference in this test
      result: { data: { usersByTestId: null } },
    },
  ]);

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: NaN, filter: undefined } })
  );

  const error = await stream.takeError();

  expect(error.message).toMatchSnapshot();
});

test("uses a mock a configured number of times when `maxUsageCount` is configured", async () => {
  const query = gql`
    query GetUser($username: String!) {
      user(username: $username) {
        id
      }
    }
  `;

  const result = { data: { user: { __typename: "User", id: 1 } } };
  const variables = { username: "username" };

  const link = new MockLink(
    [
      {
        request: { query, variables },
        maxUsageCount: 2,
        result,
      },
    ],
    { showWarnings: false }
  );

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue(result);
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue(result);
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    const error = await stream.takeError();
    expect(error.message).toMatchSnapshot();
  }
});

test("uses a mock infinite number of times when `maxUsageCount` is configured with Number.POSITIVE_INFINITY", async () => {
  const query = gql`
    query GetUser($username: String!) {
      user(username: $username) {
        id
      }
    }
  `;

  const result = { data: { user: { __typename: "User", id: 1 } } };
  const variables = { username: "username" };

  const link = new MockLink([
    {
      request: { query, variables },
      maxUsageCount: Number.POSITIVE_INFINITY,
      result,
      delay: 0,
    },
  ]);

  for (let i = 0; i < 100; i++) {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue(result);
    await expect(stream).toComplete();
  }
});

test("uses a mock once when `maxUsageCount` is not configured", async () => {
  const query = gql`
    query GetUser($username: String!) {
      user(username: $username) {
        id
      }
    }
  `;

  const result = { data: { user: { __typename: "User", id: 1 } } };
  const variables = { username: "username" };

  const link = new MockLink([{ request: { query, variables }, result }], {
    showWarnings: false,
  });

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue(result);
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    const error = await stream.takeError();
    expect(error.message).toMatchSnapshot();
  }
});

test("can still use other mocks after a mock has been fully consumed", async () => {
  const query = gql`
    query GetUser($username: String!) {
      user(username: $username) {
        id
      }
    }
  `;

  const result1 = { data: { user: { __typename: "User", id: 1 } } };
  const result2 = { data: { user: { __typename: "User", id: 2 } } };
  const variables = { username: "username" };

  const link = new MockLink([
    {
      request: { query, variables },
      maxUsageCount: 2,
      result: result1,
    },
    {
      request: { query, variables },
      result: result2,
    },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue(result1);
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue(result1);
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue(result2);
    await expect(stream).toComplete();
  }
});

test("`result` accepts callback function", async () => {
  const query = gql`
    query GetUser($username: String!) {
      user(username: $username) {
        username
      }
    }
  `;

  const variables = { username: "username" };

  const link = new MockLink([
    {
      request: { query, variables },
      result: (vars) => ({
        data: { user: { __typename: "User", name: vars.username } },
      }),
    },
  ]);

  const stream = new ObservableStream(execute(link, { query, variables }));

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", name: variables.username } },
  });
  await expect(stream).toComplete();
});

test("mocks is consumed after running `result` callback function", async () => {
  const query = gql`
    query GetUser($username: String!) {
      user(username: $username) {
        id
      }
    }
  `;

  const variables = { username: "username" };

  const link = new MockLink(
    [
      {
        request: { query, variables },
        result: (vars) => ({
          data: { user: { __typename: "User", name: vars.username } },
        }),
      },
    ],
    { showWarnings: false }
  );

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue({
      data: { user: { __typename: "User", name: variables.username } },
    });
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    const error = await stream.takeError();
    expect(error.message).toMatchSnapshot();
  }
});

test("can use `result` as callback with `maxUsageCount`", async () => {
  const query = gql`
    query GetUser($username: String!) {
      user(username: $username) {
        id
      }
    }
  `;

  const variables = { username: "username" };

  const link = new MockLink(
    [
      {
        request: { query, variables },
        result: (vars) => ({
          data: { user: { __typename: "User", name: vars.username } },
        }),
        maxUsageCount: 2,
      },
    ],
    { showWarnings: false }
  );

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue({
      data: { user: { __typename: "User", name: variables.username } },
    });
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitTypedValue({
      data: { user: { __typename: "User", name: variables.username } },
    });
    await expect(stream).toComplete();
  }

  {
    const stream = new ObservableStream(execute(link, { query, variables }));

    const error = await stream.takeError();
    expect(error.message).toMatchSnapshot();
  }
});

describe.skip("type tests", () => {
  const ANY = {} as any;
  test("covariant behaviour: `MockedResponses<X,Y>` should be assignable to `MockedResponse`", () => {
    let unspecificArray: MockedResponse[] = [];
    let specificArray: MockedResponse<{ foo: string }, { foo: string }>[] = [];
    let unspecificResponse: MockedResponse = ANY;
    let specificResponse: MockedResponse<{ foo: string }, { foo: string }> =
      ANY;

    unspecificArray.push(specificResponse);
    unspecificArray.push(unspecificResponse);

    specificArray.push(specificResponse);
    // @ts-expect-error
    specificArray.push(unspecificResponse);

    unspecificArray = [specificResponse];
    unspecificArray = [unspecificResponse];
    unspecificArray = [specificResponse, unspecificResponse];

    specificArray = [specificResponse];
    // @ts-expect-error
    specificArray = [unspecificResponse];
    // @ts-expect-error
    specificArray = [specificResponse, unspecificResponse];

    unspecificResponse = specificResponse;
    // @ts-expect-error
    specificResponse = unspecificResponse;
  });

  describe("MockedResponse.result as a callback", () => {
    const setup = () => {
      const weaklyTypedMockResponse: MockedResponse = {
        request: {
          query: gql`
            query A {
              a
            }
          `,
        },
      };

      const stronglyTypedMockResponse: MockedResponse<
        { a: string },
        { input: string }
      > = {
        request: {
          query: gql`
            query A {
              a
            }
          `,
        },
      };

      return {
        weaklyTypedMockResponse,
        stronglyTypedMockResponse,
      };
    };

    test("returned 'data' can be any object with untyped response", () => {
      const { weaklyTypedMockResponse } = setup();

      weaklyTypedMockResponse.result = ({ fake: { faker } }) => ({
        data: {
          pretend: faker,
        },
      });
    });

    test("can't return output that doesn't match TData", () => {
      const { stronglyTypedMockResponse } = setup();

      // @ts-expect-error return type does not match `TData`
      stronglyTypedMockResponse.result = () => ({
        data: {
          a: 123,
        },
      });
    });

    test("can't use input variables that don't exist in TVariables", () => {
      const { stronglyTypedMockResponse } = setup();

      // @ts-expect-error unknown variables
      stronglyTypedMockResponse.result = ({ fake: { faker } }) => ({
        data: {
          a: faker,
        },
      });
    });
  });
});
