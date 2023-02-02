import React from 'react';
import { DocumentNode } from 'graphql';
import { render, waitFor } from '@testing-library/react';
import gql from 'graphql-tag';

import { itAsync, MockedResponse, MockLink } from '../../core';
import { MockedProvider } from '../MockedProvider';
import { useQuery } from '../../../react/hooks';
import { InMemoryCache } from '../../../cache';
import { ApolloLink } from '../../../link/core';

const variables = {
  username: 'mock_username'
};

const userWithoutTypeName = {
  id: 'user_id'
};

const user = {
  __typename: 'User',
  ...userWithoutTypeName
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
      variables
    },
    result: { data: { user } }
  }
];

interface Data {
  user: {
    id: string;
  };
}

interface Variables {
  username: string;
}

let errorThrown = false;
const errorLink = new ApolloLink((operation, forward) => {
  let observer = null;
  try {
    observer = forward(operation);
  } catch (error) {
    errorThrown = true;
  }
  return observer;
});

describe('General use', () => {
  beforeEach(() => {
    errorThrown = false;
  });

  itAsync('should mock the data', (resolve, reject) => {
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

  itAsync('should allow querying with the typename', (resolve, reject) => {
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
          variables
        },
        result: { data: { user } }
      }
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

  itAsync('should allow using a custom cache', (resolve, reject) => {
    let finished = false;
    const cache = new InMemoryCache();
    cache.writeQuery({
      query,
      variables,
      data: { user }
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

  itAsync('should error if the variables in the mock and component do not match', (resolve, reject) => {
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading, error } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        expect(error).toMatchSnapshot();
        finished = true;
      }
      return null;
    }

    const variables2 = {
      username: 'other_user',
      age: undefined
    };

    render(
      <MockedProvider showWarnings={false} mocks={mocks}>
        <Component {...variables2} />
      </MockedProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true);
    }).then(resolve, reject);
  });

  itAsync('should error if the variables do not deep equal', (resolve, reject) => {
    let finished = false
    function Component({ ...variables }: Variables) {
      const { loading, error } = useQuery<Data, Variables>(query, { variables });
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
            username: 'some_user'
          }
        },
        result: { data: { user } }
      }
    ];

    const variables2 = {
      username: 'some_user',
      age: 42
    };

    render(
      <MockedProvider showWarnings={false} mocks={mocks2}>
        <Component {...variables2} />
      </MockedProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true);
    }).then(resolve, reject);
  });

  itAsync('should not error if the variables match but have different order', (resolve, reject) => {
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, { variables });
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
            username: 'some_user'
          }
        },
        result: { data: { user } }
      }
    ];

    const variables2 = {
      username: 'some_user',
      age: 13
    };

    render(
      <MockedProvider mocks={mocks2}>
        <Component {...variables2} />
      </MockedProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true);
    }).then(resolve, reject);
  });

  itAsync('should support mocking a network error', (resolve, reject) => {
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading, error } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        expect(error).toEqual(new Error('something went wrong'));
        finished = true;
      }
      return null;
    }

    const mocksError = [
      {
        request: {
          query,
          variables
        },
        error: new Error('something went wrong')
      }
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

  itAsync('should error if the query in the mock and component do not match', (resolve, reject) => {
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading, error } = useQuery<Data, Variables>(query, { variables });
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
          variables
        },
        result: { data: { user } }
      }
    ];

    render(
      <MockedProvider showWarnings={false} mocks={mocksDifferentQuery}>
        <Component {...variables} />
      </MockedProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true);
    }).then(resolve, reject);
  });

  it('should pass down props prop in mock as props for the component', () => {
    function Component({ ...variables }) {
      expect(variables.foo).toBe('bar');
      expect(variables.baz).toBe('qux');
      return null;
    }

    render(
      <MockedProvider mocks={mocks} childProps={{ foo: 'bar', baz: 'qux' }}>
        <Component {...variables} />
      </MockedProvider>
    );
  });

  it('should not crash on unmount if there is no query manager', () => {
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

  itAsync('should support returning mocked results from a function', (resolve, reject) => {
    let finished = false;
    let resultReturned = false;

    const testUser = {
      __typename: 'User',
      id: 12345
    };

    function Component({ ...variables }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, { variables });
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
      username: 'jsmith'
    };
    const testMocks = [
      {
        request: {
          query: testQuery,
          variables: testVariables
        },
        result() {
          resultReturned = true;
          return {
            data: {
              user: {
                __typename: 'User',
                id: 12345
              }
            }
          };
        }
      }
    ];

    render(
      <MockedProvider mocks={testMocks}>
        <Component {...testVariables} />
      </MockedProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true)
    }).then(resolve, reject);
  });

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
      new MockLink([], true, { showWarnings: false })
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

  it('should return "Mocked response should contain" errors in response', async () => {
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading, error } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        expect(error).toMatchSnapshot();
        finished = true;
      }
      return null;
    }

    const link = ApolloLink.from([errorLink, new MockLink([
      {
        request: {
          query,
          variables
        }
      }
    ])]);

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

  it('shows a warning in the console when there is no matched mock', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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
          variables
        },
        result: { data: { user } }
      }
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
      expect.stringContaining('No more mocked responses for the query')
    );

    consoleSpy.mockRestore();
  });

  it('silences console warning for unmatched mocks when `showWarnings` is `false`', async () => {
    const consoleSpy = jest.spyOn(console, 'warn');
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
          variables
        },
        result: { data: { user } }
      }
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

  it('silences console warning for unmatched mocks when passing `showWarnings` to `MockLink` directly', async () => {
    const consoleSpy = jest.spyOn(console, 'warn');
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
         variables
        },
        result: { data: { user } }
      }
    ];

    const link = new MockLink(
      mocksDifferentQuery,
      false,
      { showWarnings: false }
    );

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

  itAsync('should support custom error handling using setOnError', (resolve, reject) => {
    let finished = false;
    function Component({ ...variables }: Variables) {
      useQuery<Data, Variables>(query, { variables });
      return null;
    }

    const mockLink = new MockLink([], true, { showWarnings: false });
    mockLink.setOnError(error => {
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
  });

  itAsync('should pipe exceptions thrown in custom onError functions through the link chain', (resolve, reject) => {
    let finished = false;
    function Component({ ...variables }: Variables) {
      const { loading, error } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        expect(error).toMatchSnapshot();
        finished = true;
      }
      return null;
    }

    const mockLink = new MockLink([], true, { showWarnings: false });
    mockLink.setOnError(() => {
      throw new Error('oh no!');
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
  });
});

describe('@client testing', () => {
  itAsync('should support @client fields with a custom cache', (resolve, reject) => {
    let finished = false;
    const cache = new InMemoryCache();

    cache.writeQuery({
      query: gql`{
        networkStatus {
          isOnline
        }
      }`,
      data: {
        networkStatus: {
          __typename: 'NetworkStatus',
          isOnline: true
        }
      },
    });

    function Component() {
      const { loading, data } = useQuery(gql`{
        networkStatus @client {
          isOnline
        }
      }`);
      if (!loading) {
        expect(data!.networkStatus.__typename).toEqual('NetworkStatus');
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
  });

  itAsync('should support @client fields with field policies', (resolve, reject) => {
    let finished = false;
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            networkStatus() {
              return {
                __typename: 'NetworkStatus',
                isOnline: true
              };
            }
          }
        }
      }
    });

    function Component() {
      const { loading, data } = useQuery(gql`{
        networkStatus @client {
          isOnline
        }
      }`);
      if (!loading) {
        expect(data!.networkStatus.__typename).toEqual('NetworkStatus');
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
  });
});
