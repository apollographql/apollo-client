import { gql } from "graphql-tag";

import { execute } from "@apollo/client/link/core";
import type { MockedResponse } from "@apollo/client/testing";
import { MockLink } from "@apollo/client/testing";
import {
  enableFakeTimers,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { InvariantError } from "@apollo/client/utilities/invariant";

// This is an internal function and will not be exported publicly
// eslint-disable-next-line local-rules/no-relative-imports
import { stringifyMockedResponse } from "../mockLink.js";

describe("MockedResponse.newData", () => {
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

    weaklyTypedMockResponse.newData = ({ fake: { faker } }) => ({
      data: {
        pretend: faker,
      },
    });
  });

  test("can't return output that doesn't match TData", () => {
    const { stronglyTypedMockResponse } = setup();

    // @ts-expect-error return type does not match `TData`
    stronglyTypedMockResponse.newData = () => ({
      data: {
        a: 123,
      },
    });
  });

  test("can't use input variables that don't exist in TVariables", () => {
    const { stronglyTypedMockResponse } = setup();

    // @ts-expect-error unknown variables
    stronglyTypedMockResponse.newData = ({ fake: { faker } }) => ({
      data: {
        a: faker,
      },
    });
  });
});

/*
We've chosen this value as the MAXIMUM_DELAY since values that don't fit into a 32-bit signed int cause setTimeout to fire immediately
*/
const MAXIMUM_DELAY = 0x7f_ff_ff_ff;

describe("mockLink", () => {
  const query = gql`
    query A {
      a
    }
  `;

  it("should not require a result or error when delay equals Infinity", async () => {
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

  it("should require result or error when delay is just large", () => {
    const invalidResponse = { request: { query }, delay: MAXIMUM_DELAY };
    const expectedError = new InvariantError(
      `Mocked response should contain either \`result\`, \`error\` or a \`delay\` of \`Infinity\`:\n${stringifyMockedResponse(
        invalidResponse
      )}`
    );

    expect(() => new MockLink([invalidResponse])).toThrow(expectedError);

    expect(
      () =>
        new MockLink([
          // This one is ok
          {
            request: { query },
            error: new Error("test"),
            delay: MAXIMUM_DELAY,
          },
          invalidResponse,
        ])
    ).toThrow(expectedError);

    const link = new MockLink([]);

    expect(() => link.addMockedResponse(invalidResponse)).toThrow(
      expectedError
    );
  });

  it("should fill in default variables if they are missing in mocked requests", async () => {
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

// TODO: Should we consider combining these options and allowing `variables` to
// accept a callback function? Doing so would make this error obsolete.
test("throws error when passing variableMatcher and variables", async () => {
  expect(
    () =>
      new MockLink([
        {
          request: {
            query: gql`
              query ($id: ID!) {
                user(id: $id) {
                  name
                }
              }
            `,
            variables: { id: 1 },
          },
          variableMatcher: () => true,
          result: {
            data: null,
          },
        },
      ])
  ).toThrow(
    new InvariantError(
      "Mocked response should use either `request.variables` or `variableMatcher` but not both"
    )
  );
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

test("passes variables to the variableMatcher", async () => {
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
      request: { query },
      variableMatcher,
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

test("uses mock when variableMatcher returns true", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `;

  const link = new MockLink([
    {
      request: { query },
      variableMatcher: ({ id }) => id === 1,
      result: { data: { user: { __typename: "User", name: "User 1" } } },
    },
    {
      request: { query },
      variableMatcher: ({ id }) => id === 2,
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

test("fails when variableMatcher returns false", async () => {
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
        variableMatcher: () => false,
        result: { data: { user: { __typename: "User", name: "User 1" } } },
      },
    ],
    { showWarnings: false }
  );

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 1 } })
  );

  const error = await stream.takeError();
  expect(error.message).toMatch(/^No more mocked responses/);
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
});
