import gql from 'graphql-tag';
import { DocumentNode, ExecutionResult } from 'graphql';
import { assign } from 'lodash';

import mockQueryManager from '../../__mocks__/mockQueryManager';
import { Observer } from '../../util/Observable';
import wrap from '../../util/wrap';
import { ApolloQueryResult, Resolvers } from '../../core/types';
import { WatchQueryOptions } from '../../core/watchQueryOptions';

// Helper method that sets up a mockQueryManager and then passes on the
// results to an observer.
const assertWithObserver = ({
  done,
  resolvers,
  query,
  serverQuery,
  variables = {},
  queryOptions = {},
  serverResult,
  error,
  delay,
  observer,
}: {
  done: jest.DoneCallback;
  resolvers?: Resolvers;
  query: DocumentNode;
  serverQuery?: DocumentNode;
  variables?: object;
  queryOptions?: object;
  error?: Error;
  serverResult?: ExecutionResult;
  delay?: number;
  observer: Observer<ApolloQueryResult<any>>;
}) => {
  const queryManager = mockQueryManager({
    request: { query: serverQuery, variables },
    result: serverResult,
    error,
    delay,
  });

  if (resolvers) {
    queryManager.addResolvers(resolvers);
  }

  const finalOptions = assign(
    { query, variables },
    queryOptions,
  ) as WatchQueryOptions;
  return queryManager.watchQuery<any>(finalOptions).subscribe({
    next: wrap(done, observer.next!),
    error: observer.error,
  });
};

describe('Basic resolver capabilities', () => {
  it('should run resolvers for @client queries', done => {
    const query = gql`
      query Test {
        foo @client {
          bar
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ bar: true }),
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({ foo: { bar: true } });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });

  it('should handle queries with a mix of @client and server fields', done => {
    const query = gql`
      query Mixed {
        foo @client {
          bar
        }
        bar {
          baz
        }
      }
    `;

    const serverQuery = gql`
      query Mixed {
        bar {
          baz
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ bar: true }),
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      serverQuery,
      serverResult: { data: { bar: { baz: true } } },
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({ foo: { bar: true }, bar: { baz: true } });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });

  it('should handle a mix of @client fields with fragments and server fields', done => {
    const query = gql`
      fragment client on ClientData {
        bar
        __typename
      }

      query Mixed {
        foo @client {
          ...client
        }
        bar {
          baz
        }
      }
    `;

    const serverQuery = gql`
      fragment client on ClientData {
        bar
        __typename
      }
      query Mixed {
        bar {
          baz
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ bar: true, __typename: 'ClientData' }),
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      serverQuery,
      serverResult: { data: { bar: { baz: true, __typename: 'Bar' } } },
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({
              foo: { bar: true, __typename: 'ClientData' },
              bar: { baz: true },
            });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });

  it('should have access to query variables when running @client resolvers', done => {
    const query = gql`
      query WithVariables($id: ID!) {
        foo @client {
          bar(id: $id)
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ __typename: 'Foo' }),
      },
      Foo: {
        bar: (data: any, { id }: { id: number }) => id,
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      variables: { id: 1 },
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({ foo: { bar: 1 } });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });

  it('should pass context to @client resolvers', done => {
    const query = gql`
      query WithContext {
        foo @client {
          bar
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ __typename: 'Foo' }),
      },
      Foo: {
        bar: (data: any, _: any, { id }: { id: number }) => id,
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      queryOptions: { context: { id: 1 } },
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({ foo: { bar: 1 } });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });
});
