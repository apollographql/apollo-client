import React from "react";
import { DocumentNode } from "graphql";
import { act, render, screen, waitFor } from "@testing-library/react";
import gql from "graphql-tag";

import { itAsync, MockedResponse, MockLink } from "../../core";
import { MockedProvider } from "../MockedProvider";
import { useQuery } from "../../../react/hooks";
import { InMemoryCache } from "../../../cache";
import { QueryResult } from "../../../react/types/types";
import { ApolloLink, FetchResult } from "../../../link/core";
import { Observable } from "zen-observable-ts";
import { ApolloError } from "../../../errors";

const variables = {
  username: "mock_username",
};

const userWithoutTypeName = {
  id: "user_id",
};

const user = {
  __typename: "User",
  ...userWithoutTypeName,
};

const query: DocumentNode = gql`
  query GetUser($username: String!) {
    user(username: $username) {
      id
    }
  }
`;

const queryWithTypename: DocumentNode = gql`
  query GetUser($username: String!) {
    user(username: $username) {
      id
      __typename
    }
  }
`;

const mocks: ReadonlyArray<MockedResponse> = [
  {
    request: {
      query,
      variables,
    },
    result: { data: { user } },
  },
];

interface Data {
  user: {
    id: string;
  };
}

interface Result {
  current: QueryResult<any, any> | null;
}

interface Variables {
  username: string;
}

let errorThrown = false;
const errorLink = new ApolloLink((operation, forward) => {
  let observer: Observable<FetchResult> | null = null;
  try {
    observer = forward(operation);
  } catch (error) {
    errorThrown = true;
  }
  return observer;
});

describe("General use", () => {
  beforeEach(() => {
    errorThrown = false;
  });

  itAsync("should mock the data", (resolve, reject) => {
    let finished = false;
    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        expect(data!.user).toMatchSnapshot();
        finished = true;
      }
      return null;
    }

    render(
      <MockedProvider mocks={mocks}>
        <Component {...variables} />
      </MockedProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true);
    }).then(resolve, reject);
  });

  itAsync(
    "should pass the variables to the result function",
    async (resolve, reject) => {
      function Component({ ...variables }: Variables) {
        useQuery<Data, Variables>(query, { variables });
        return null;
      }

      const mock2: MockedResponse<Data, Variables> = {
        request: {
          query,
          variables,
        },
        result: jest.fn().mockResolvedValue({ data: { user } }),
      };

      render(
        <MockedProvider mocks={[mock2]}>
          <Component {...variables} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(mock2.result as jest.Mock).toHaveBeenCalledWith(variables);
      }).then(resolve, reject);
    }
  );

  itAsync(
    "should pass the variables to the variableMatcher",
    async (resolve, reject) => {
      function Component({ ...variables }: Variables) {
        useQuery<Data, Variables>(query, { variables });
        return null;
      }

      const mock2: MockedResponse<Data, Variables> = {
        request: {
          query,
        },
        variableMatcher: jest.fn().mockReturnValue(true),
        result: { data: { user } },
      };

      render(
        <MockedProvider mocks={[mock2]}>
          <Component {...variables} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(mock2.variableMatcher as jest.Mock).toHaveBeenCalledWith(
          variables
        );
      }).then(resolve, reject);
    }
  );

  itAsync(
    "should use a mock if the variableMatcher returns true",
    async (resolve, reject) => {
      let finished = false;

      function Component({ username }: Variables) {
        const { loading, data } = useQuery<Data, Variables>(query, {
          variables,
        });
        if (!loading) {
          expect(data!.user).toMatchSnapshot();
          finished = true;
        }
        return null;
      }

      const mock2: MockedResponse<Data, Variables> = {
        request: {
          query,
        },
        variableMatcher: (v) => v.username === variables.username,
        result: { data: { user } },
      };

      render(
        <MockedProvider mocks={[mock2]}>
          <Component {...variables} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  itAsync("should allow querying with the typename", (resolve, reject) => {
    let finished = false;
    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        expect(data!.user).toMatchSnapshot();
        finished = true;
      }
      return null;
    }

    const mocksWithTypename = [
      {
        request: {
          query: queryWithTypename,
          variables,
        },
        result: { data: { user } },
      },
    ];

    render(
      <MockedProvider mocks={mocksWithTypename}>
        <Component {...variables} />
      </MockedProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true);
    }).then(resolve, reject);
  });

  itAsync("should allow using a custom cache", (resolve, reject) => {
    let finished = false;
    const cache = new InMemoryCache();
    cache.writeQuery({
      query,
      variables,
      data: { user },
    });

    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        expect(data).toMatchObject({ user });
        finished = true;
      }
      return null;
    }

    render(
      <MockedProvider mocks={[]} cache={cache}>
        <Component {...variables} />
      </MockedProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true);
    }).then(resolve, reject);
  });

  itAsync(
    "should error if the variables in the mock and component do not match",
    (resolve, reject) => {
      let finished = false;
      function Component({ ...variables }: Variables) {
        const { loading, error } = useQuery<Data, Variables>(query, {
          variables,
        });
        if (!loading) {
          expect(error).toMatchSnapshot();
          finished = true;
        }
        return null;
      }

      const variables2 = {
        username: "other_user",
        age: undefined,
      };

      render(
        <MockedProvider showWarnings={false} mocks={mocks}>
          <Component {...variables2} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  itAsync(
    "should error if the variableMatcher returns false",
    async (resolve, reject) => {
      let finished = false;
      function Component({ ...variables }: Variables) {
        const { loading, error } = useQuery<Data, Variables>(query, {
          variables,
        });
        if (!loading) {
          expect(error).toMatchSnapshot();
          finished = true;
        }
        return null;
      }

      const mock2: MockedResponse<Data, Variables> = {
        request: {
          query,
        },
        variableMatcher: () => false,
        result: { data: { user } },
      };

      render(
        <MockedProvider showWarnings={false} mocks={[mock2]}>
          <Component {...variables} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  itAsync(
    "should error if the variables do not deep equal",
    (resolve, reject) => {
      let finished = false;
      function Component({ ...variables }: Variables) {
        const { loading, error } = useQuery<Data, Variables>(query, {
          variables,
        });
        if (!loading) {
          expect(error).toMatchSnapshot();
          finished = true;
        }
        return null;
      }

      const mocks2 = [
        {
          request: {
            query,
            variables: {
              age: 13,
              username: "some_user",
            },
          },
          result: { data: { user } },
        },
      ];

      const variables2 = {
        username: "some_user",
        age: 42,
      };

      render(
        <MockedProvider showWarnings={false} mocks={mocks2}>
          <Component {...variables2} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  itAsync(
    "should not error if the variables match but have different order",
    (resolve, reject) => {
      let finished = false;
      function Component({ ...variables }: Variables) {
        const { loading, data } = useQuery<Data, Variables>(query, {
          variables,
        });
        if (!loading) {
          expect(data).toMatchSnapshot();
          finished = true;
        }
        return null;
      }

      const mocks2 = [
        {
          request: {
            query,
            variables: {
              age: 13,
              username: "some_user",
            },
          },
          result: { data: { user } },
        },
      ];

      const variables2 = {
        username: "some_user",
        age: 13,
      };

      render(
        <MockedProvider mocks={mocks2}>
          <Component {...variables2} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  itAsync("should support mocking a network error", (resolve, reject) => {
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading, error } = useQuery<Data, Variables>(query, {
        variables,
      });
      if (!loading) {
        expect(error).toEqual(
          new ApolloError({ networkError: new Error("something went wrong") })
        );
        finished = true;
      }
      return null;
    }

    const mocksError = [
      {
        request: {
          query,
          variables,
        },
        error: new Error("something went wrong"),
      },
    ];

    render(
      <MockedProvider mocks={mocksError}>
        <Component {...variables} />
      </MockedProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true);
    }).then(resolve, reject);
  });

  itAsync(
    "should error if the query in the mock and component do not match",
    (resolve, reject) => {
      let finished = false;
      function Component({ ...variables }: Variables) {
        const { loading, error } = useQuery<Data, Variables>(query, {
          variables,
        });
        if (!loading) {
          expect(error).toMatchSnapshot();
          finished = true;
        }
        return null;
      }

      const mocksDifferentQuery = [
        {
          request: {
            query: gql`
              query OtherQuery {
                otherQuery {
                  id
                }
              }
            `,
            variables,
          },
          result: { data: { user } },
        },
      ];

      render(
        <MockedProvider showWarnings={false} mocks={mocksDifferentQuery}>
          <Component {...variables} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  it("should pass down props prop in mock as props for the component", () => {
    function Component({ ...variables }) {
      expect(variables.foo).toBe("bar");
      expect(variables.baz).toBe("qux");
      return null;
    }

    render(
      <MockedProvider mocks={mocks} childProps={{ foo: "bar", baz: "qux" }}>
        <Component {...variables} />
      </MockedProvider>
    );
  });

  it("should not crash on unmount if there is no query manager", () => {
    function Component() {
      return null;
    }

    const { unmount } = render(
      <MockedProvider>
        <Component />
      </MockedProvider>
    );

    unmount();
  });

  itAsync(
    "should support returning mocked results from a function",
    (resolve, reject) => {
      let finished = false;
      let resultReturned = false;

      const testUser = {
        __typename: "User",
        id: 12345,
      };

      function Component({ ...variables }: Variables) {
        const { loading, data } = useQuery<Data, Variables>(query, {
          variables,
        });
        if (!loading) {
          expect(data!.user).toEqual(testUser);
          expect(resultReturned).toBe(true);
          finished = true;
        }
        return null;
      }

      const testQuery: DocumentNode = gql`
        query GetUser($username: String!) {
          user(username: $username) {
            id
          }
        }
      `;

      const testVariables = {
        username: "jsmith",
      };
      const testMocks = [
        {
          request: {
            query: testQuery,
            variables: testVariables,
          },
          result() {
            resultReturned = true;
            return {
              data: {
                user: {
                  __typename: "User",
                  id: 12345,
                },
              },
            };
          },
        },
      ];

      render(
        <MockedProvider mocks={testMocks}>
          <Component {...testVariables} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  it('should return "No more mocked responses" errors in response', async () => {
    let finished = false;
    function Component() {
      const { loading, error } = useQuery(query);
      if (!loading) {
        expect(error).toMatchSnapshot();
        finished = true;
      }
      return null;
    }

    const link = ApolloLink.from([
      errorLink,
      new MockLink([], true, { showWarnings: false }),
    ]);

    render(
      <MockedProvider link={link}>
        <Component />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(finished).toBe(true);
    });
    // The "No more mocked responses" error should not be thrown as an
    // uncaught exception.
    expect(errorThrown).toBeFalsy();
  });

  it("Uses a mock a configured number of times when `maxUsageCount` is configured", async () => {
    const result: Result = { current: null };
    function Component({ username }: Variables) {
      result.current = useQuery<Data, Variables>(query, {
        variables: { username },
      });
      return null;
    }

    const waitForLoaded = async () => {
      await waitFor(() => {
        expect(result.current?.loading).toBe(false);
        expect(result.current?.error).toBeUndefined();
      });
    };

    const waitForError = async () => {
      await waitFor(() => {
        expect(result.current?.error?.message).toMatch(
          /No more mocked responses/
        );
      });
    };

    const refetch = () => {
      return act(async () => {
        try {
          await result.current?.refetch();
        } catch {}
      });
    };

    const mocks: ReadonlyArray<MockedResponse> = [
      {
        request: {
          query,
          variables: {
            username: "mock_username",
          },
        },
        maxUsageCount: 2,
        result: { data: { user } },
      },
    ];

    const mockLink = new MockLink(mocks, true, { showWarnings: false });
    const link = ApolloLink.from([errorLink, mockLink]);
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <MockedProvider link={link}>{children}</MockedProvider>
    );

    render(<Component username="mock_username" />, { wrapper: Wrapper });
    await waitForLoaded();
    await refetch();
    await waitForLoaded();
    await refetch();
    await waitForError();
  });

  it("Uses a mock infinite number of times when `maxUsageCount` is configured with Number.POSITIVE_INFINITY", async () => {
    const result: Result = { current: null };
    function Component({ username }: Variables) {
      result.current = useQuery<Data, Variables>(query, {
        variables: { username },
      });
      return null;
    }

    const waitForLoaded = async () => {
      await waitFor(() => {
        expect(result.current?.loading).toBe(false);
        expect(result.current?.error).toBeUndefined();
      });
    };

    const refetch = () => {
      return act(async () => {
        try {
          await result.current?.refetch();
        } catch {}
      });
    };

    const mocks: ReadonlyArray<MockedResponse> = [
      {
        request: {
          query,
          variables: {
            username: "mock_username",
          },
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
        result: { data: { user } },
      },
    ];

    const mockLink = new MockLink(mocks, true, { showWarnings: false });
    const link = ApolloLink.from([errorLink, mockLink]);
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <MockedProvider link={link}>{children}</MockedProvider>
    );

    render(<Component username="mock_username" />, { wrapper: Wrapper });
    for (let i = 0; i < 100; i++) {
      await waitForLoaded();
      await refetch();
    }
    await waitForLoaded();
  });

  it("uses a mock once when `maxUsageCount` is not configured", async () => {
    const result: Result = { current: null };
    function Component({ username }: Variables) {
      result.current = useQuery<Data, Variables>(query, {
        variables: { username },
      });
      return null;
    }

    const waitForLoaded = async () => {
      await waitFor(() => {
        expect(result.current?.loading).toBe(false);
        expect(result.current?.error).toBeUndefined();
      });
    };

    const waitForError = async () => {
      await waitFor(() => {
        expect(result.current?.error?.message).toMatch(
          /No more mocked responses/
        );
      });
    };

    const refetch = () => {
      return act(async () => {
        try {
          await result.current?.refetch();
        } catch {}
      });
    };

    const mocks: ReadonlyArray<MockedResponse> = [
      {
        request: {
          query,
          variables: {
            username: "mock_username",
          },
        },
        result: { data: { user } },
      },
    ];

    const mockLink = new MockLink(mocks, true, { showWarnings: false });
    const link = ApolloLink.from([errorLink, mockLink]);
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <MockedProvider link={link}>{children}</MockedProvider>
    );

    render(<Component username="mock_username" />, { wrapper: Wrapper });
    await waitForLoaded();
    await refetch();
    await waitForError();
  });

  it("can still use other mocks after a mock has been fully consumed", async () => {
    const result: Result = { current: null };
    function Component({ username }: Variables) {
      result.current = useQuery<Data, Variables>(query, {
        variables: { username },
      });
      return null;
    }

    const waitForLoaded = async () => {
      await waitFor(() => {
        expect(result.current?.loading).toBe(false);
        expect(result.current?.error).toBeUndefined();
      });
    };

    const refetch = () => {
      return act(async () => {
        try {
          await result.current?.refetch();
        } catch {}
      });
    };

    const mocks: ReadonlyArray<MockedResponse> = [
      {
        request: {
          query,
          variables: {
            username: "mock_username",
          },
        },
        maxUsageCount: 2,
        result: { data: { user } },
      },
      {
        request: {
          query,
          variables: {
            username: "mock_username",
          },
        },
        result: {
          data: {
            user: {
              __typename: "User",
              id: "new_id",
            },
          },
        },
      },
    ];

    const mockLink = new MockLink(mocks, true, { showWarnings: false });
    const link = ApolloLink.from([errorLink, mockLink]);
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <MockedProvider link={link}>{children}</MockedProvider>
    );

    render(<Component username="mock_username" />, { wrapper: Wrapper });
    await waitForLoaded();
    await refetch();
    await waitForLoaded();
    await refetch();
    await waitForLoaded();
    expect(result.current?.data?.user).toEqual({
      __typename: "User",
      id: "new_id",
    });
  });

  it('should return "Mocked response should contain" errors in response', async () => {
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading, error } = useQuery<Data, Variables>(query, {
        variables,
      });
      if (!loading) {
        expect(error).toMatchSnapshot();
        finished = true;
      }
      return null;
    }

    const link = ApolloLink.from([
      errorLink,
      new MockLink([
        {
          request: {
            query,
            variables,
          },
        },
      ]),
    ]);

    render(
      <MockedProvider link={link}>
        <Component {...variables} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(finished).toBe(true);
    });
    // The "Mocked response should contain" error should not be thrown as an
    // uncaught exception.
    expect(errorThrown).toBeFalsy();
  });

  it("shows a warning in the console when there is no matched mock", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        finished = true;
      }
      return null;
    }

    const mocksDifferentQuery = [
      {
        request: {
          query: gql`
            query OtherQuery {
              otherQuery {
                id
              }
            }
          `,
          variables,
        },
        result: { data: { user } },
      },
    ];

    render(
      <MockedProvider mocks={mocksDifferentQuery}>
        <Component {...variables} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(finished).toBe(true);
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("No more mocked responses for the query")
    );

    consoleSpy.mockRestore();
  });

  it("silences console warning for unmatched mocks when `showWarnings` is `false`", async () => {
    const consoleSpy = jest.spyOn(console, "warn");
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        finished = true;
      }
      return null;
    }

    const mocksDifferentQuery = [
      {
        request: {
          query: gql`
            query OtherQuery {
              otherQuery {
                id
              }
            }
          `,
          variables,
        },
        result: { data: { user } },
      },
    ];

    render(
      <MockedProvider mocks={mocksDifferentQuery} showWarnings={false}>
        <Component {...variables} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(finished).toBe(true);
    });

    expect(console.warn).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("silences console warning for unmatched mocks when passing `showWarnings` to `MockLink` directly", async () => {
    const consoleSpy = jest.spyOn(console, "warn");
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        finished = true;
      }
      return null;
    }

    const mocksDifferentQuery = [
      {
        request: {
          query: gql`
            query OtherQuery {
              otherQuery {
                id
              }
            }
          `,
          variables,
        },
        result: { data: { user } },
      },
    ];

    const link = new MockLink(mocksDifferentQuery, false, {
      showWarnings: false,
    });

    render(
      <MockedProvider link={link}>
        <Component {...variables} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(finished).toBe(true);
    });

    expect(console.warn).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  itAsync(
    "should support custom error handling using setOnError",
    (resolve, reject) => {
      let finished = false;
      function Component({ ...variables }: Variables) {
        useQuery<Data, Variables>(query, { variables });
        return null;
      }

      const mockLink = new MockLink([], true, { showWarnings: false });
      mockLink.setOnError((error) => {
        expect(error).toMatchSnapshot();
        finished = true;
      });
      const link = ApolloLink.from([errorLink, mockLink]);

      render(
        <MockedProvider link={link}>
          <Component {...variables} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  itAsync(
    "should pipe exceptions thrown in custom onError functions through the link chain",
    (resolve, reject) => {
      let finished = false;
      function Component({ ...variables }: Variables) {
        const { loading, error } = useQuery<Data, Variables>(query, {
          variables,
        });
        if (!loading) {
          expect(error).toMatchSnapshot();
          finished = true;
        }
        return null;
      }

      const mockLink = new MockLink([], true, { showWarnings: false });
      mockLink.setOnError(() => {
        throw new Error("oh no!");
      });
      const link = ApolloLink.from([errorLink, mockLink]);

      render(
        <MockedProvider link={link}>
          <Component {...variables} />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  it("should support loading state testing with delay", async () => {
    jest.useFakeTimers();

    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, { variables });

      if (loading || data === undefined) return <p>Loading the user ID...</p>;

      return <p>The user ID is '{data.user.id}'</p>;
    }

    const mocks: ReadonlyArray<MockedResponse> = [
      {
        delay: 30000, // prevent React from batching the loading state away
        request: {
          query,
          variables,
        },
        result: { data: { user } },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <Component {...variables} />
      </MockedProvider>
    );

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    jest.advanceTimersByTime(30_000);

    expect(
      await screen.findByText("The user ID is 'user_id'")
    ).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("should support an infinite loading state with result and delay: Infinity", async () => {
    jest.useFakeTimers();

    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, {
        variables,
      });

      if (loading) return <p>Loading the user ID...</p>;
      if (data === undefined) return <p>Undefined data</p>;

      return <p>The user ID is '{data.user.id}'</p>;
    }

    const mocks: ReadonlyArray<MockedResponse> = [
      {
        delay: Infinity, // keep loading forever.
        request: {
          query,
          variables,
        },
        result: { data: { user } },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <Component {...variables} />
      </MockedProvider>
    );

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    jest.advanceTimersByTime(Number.MAX_SAFE_INTEGER);

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    expect(screen.queryByText(/The user ID is/i)).toBeNull();

    jest.useRealTimers();
  });

  it("should support an infinite loading state with error and delay: Infinity", async () => {
    jest.useFakeTimers();

    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, {
        variables,
      });

      if (loading) return <p>Loading the user ID...</p>;
      if (data === undefined) return <p>Undefined data</p>;

      return <p>The user ID is '{data.user.id}'</p>;
    }

    const mocks: ReadonlyArray<MockedResponse> = [
      {
        delay: Infinity, // keep loading forever.
        request: {
          query,
          variables,
        },
        error: new Error("something went wrong"),
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <Component {...variables} />
      </MockedProvider>
    );

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    jest.advanceTimersByTime(Number.MAX_SAFE_INTEGER);

    expect(
      await screen.findByText("Loading the user ID...")
    ).toBeInTheDocument();

    expect(screen.queryByText(/The user ID is/i)).toBeNull();

    jest.useRealTimers();
  });
});

describe("@client testing", () => {
  itAsync(
    "should support @client fields with a custom cache",
    (resolve, reject) => {
      let finished = false;
      const cache = new InMemoryCache();

      cache.writeQuery({
        query: gql`
          {
            networkStatus {
              isOnline
            }
          }
        `,
        data: {
          networkStatus: {
            __typename: "NetworkStatus",
            isOnline: true,
          },
        },
      });

      function Component() {
        const { loading, data } = useQuery(gql`
          {
            networkStatus @client {
              isOnline
            }
          }
        `);
        if (!loading) {
          expect(data!.networkStatus.__typename).toEqual("NetworkStatus");
          expect(data!.networkStatus.isOnline).toEqual(true);
          finished = true;
        }
        return null;
      }

      render(
        <MockedProvider cache={cache}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );

  itAsync(
    "should support @client fields with field policies",
    (resolve, reject) => {
      let finished = false;
      const cache = new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              networkStatus() {
                return {
                  __typename: "NetworkStatus",
                  isOnline: true,
                };
              },
            },
          },
        },
      });

      function Component() {
        const { loading, data } = useQuery(gql`
          {
            networkStatus @client {
              isOnline
            }
          }
        `);
        if (!loading) {
          expect(data!.networkStatus.__typename).toEqual("NetworkStatus");
          expect(data!.networkStatus.isOnline).toEqual(true);
          finished = true;
        }
        return null;
      }

      render(
        <MockedProvider cache={cache}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    }
  );
});
