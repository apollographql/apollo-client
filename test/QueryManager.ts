import {
  QueryManager,
} from '../src/QueryManager';

import {
  NetworkInterface,
  Request,
} from '../src/networkInterface';

import {
  createApolloStore,
} from '../src/store';

import {
  assert,
} from 'chai';

import {
  GraphQLResult,
  parse,
  print,
} from 'graphql';

import {
  series,
} from 'async';

describe('QueryManager', () => {
  it('properly roundtrips through a Redux store', (done) => {
    const query = `
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const networkInterface = mockNetworkInterface([
      {
        request: { query },
        result: { data },
      },
    ]);

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
    });

    const handle = queryManager.watchQuery({
      query,
    });

    handle.onResult((result) => {
      assert.deepEqual(result.data, data);
      done();
    });
  });

  it('properly roundtrips through a Redux store with variables', (done) => {
    const query = `
      query people($firstArg: Int) {
        allPeople(first: $firstArg) {
          people {
            name
          }
        }
      }
    `;

    const variables = {
      firstArg: 1,
    };

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const networkInterface = mockNetworkInterface([
      {
        request: { query, variables },
        result: { data },
      },
    ]);

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
    });

    const handle = queryManager.watchQuery({
      query,
      variables,
    });

    handle.onResult((result) => {
      assert.deepEqual(result.data, data);
      done();
    });
  });

  it('handles GraphQL errors', (done) => {
    const query = `
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const networkInterface = mockNetworkInterface([
      {
        request: { query },
        result: {
          errors: [
            {
              name: 'Name',
              message: 'This is an error message.',
            },
          ],
        },
      },
    ]);

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
    });

    const handle = queryManager.watchQuery({
      query,
    });

    handle.onResult((result) => {
      assert.equal(result.errors[0].message, 'This is an error message.');
      done();
    });
  });

  it('runs a mutation', () => {
    const mutation = `
      mutation makeListPrivate {
        makeListPrivate(id: "5")
      }
    `;

    const data = {
      makeListPrivate: true,
    };

    const networkInterface = mockNetworkInterface([
      {
        request: { query: mutation },
        result: { data },
      },
    ]);

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
    });

    return queryManager.mutate({
      mutation,
    }).then((result) => {
      assert.deepEqual(result.data, data);
    });
  });

  it('runs a mutation with variables', () => {
    const mutation = `
      mutation makeListPrivate($listId: ID!) {
        makeListPrivate(id: $listId)
      }
    `;

    const variables = {
      listId: '1',
    };

    const data = {
      makeListPrivate: true,
    };

    const networkInterface = mockNetworkInterface([
      {
        request: { query: mutation, variables },
        result: { data },
      },
    ]);

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
    });

    return queryManager.mutate({
      mutation,
      variables,
    }).then((result) => {
      assert.deepEqual(result.data, data);
    });
  });

  it('runs a mutation and puts the result in the store', () => {
    const mutation = `
      mutation makeListPrivate {
        makeListPrivate(id: "5") {
          id,
          isPrivate,
        }
      }
    `;

    const data = {
      makeListPrivate: {
        id: '5',
        isPrivate: true,
      },
    };

    const networkInterface = mockNetworkInterface([
      {
        request: { query: mutation },
        result: { data },
      },
    ]);

    const store = createApolloStore();

    const queryManager = new QueryManager({
      networkInterface,
      store,
    });

    return queryManager.mutate({
      mutation,
    }).then((result) => {
      assert.deepEqual(result.data, data);

      // Make sure we updated the store with the new data
      assert.deepEqual(store.getState().data['5'], { id: '5', isPrivate: true });
    });
  });

  it('runs a mutation and puts the result in the store', () => {
    const mutation = `
      mutation makeListPrivate {
        makeListPrivate(id: "5") {
          id,
          isPrivate,
        }
      }
    `;

    const data = {
      makeListPrivate: {
        id: '5',
        isPrivate: true,
      },
    };

    const networkInterface = mockNetworkInterface([
      {
        request: { query: mutation },
        result: { data },
      },
    ]);

    const store = createApolloStore();

    const queryManager = new QueryManager({
      networkInterface,
      store,
    });

    return queryManager.mutate({
      mutation,
    }).then((result) => {
      assert.deepEqual(result.data, data);

      // Make sure we updated the store with the new data
      assert.deepEqual(store.getState().data['5'], { id: '5', isPrivate: true });
    });
  });

  it('diffs queries', (done) => {
    testDiffing([
      {
        query: `
          {
            people_one(id: "1") {
              __typename,
              id,
              name
            }
          }
        `,
        diffedQuery: `
          {
            people_one(id: "1") {
              __typename,
              id,
              name
            }
          }
        `,
        diffedQueryResponse: {
          people_one: {
            __typename: 'Person',
            id: 'lukeId',
            name: 'Luke Skywalker',
          },
        },
        fullResponse: {
          people_one: {
            __typename: 'Person',
            id: 'lukeId',
            name: 'Luke Skywalker',
          },
        },
        variables: {},
      },
      {
        query: `
          {
            people_one(id: "1") {
              name
              age
            }
          }
        `,
        diffedQuery: `
          {
            __node_0: node(id: "lukeId") {
              id
              ... on Person {
                age
              }
            }
          }
        `,
        diffedQueryResponse: {
          __node_0: {
            id: 'lukeId',
            age: 45,
          },
        },
        fullResponse: {
          people_one: {
            name: 'Luke Skywalker',
            age: 45,
          },
        },
        variables: {},
      },
      {
        query: `
          {
            people_one(id: "1") {
              id
              name
              age
            }
          }
        `,
        diffedQuery: null,
        diffedQueryResponse: null,
        fullResponse: {
          people_one: {
            id: 'lukeId',
            name: 'Luke Skywalker',
            age: 45,
          },
        },
        variables: {},
      },
    ], done);
  });
});

// Pass in an array of requests and responses, so that you can test flows that end up making
// multiple queries to the server
function mockNetworkInterface(
  requestResultArray: {
    request: Request,
    result: GraphQLResult,
  }[]
) {
  const requestToResultMap: any = {};

  // Populate set of mocked requests
  requestResultArray.forEach(({ request, result }) => {
    requestToResultMap[requestToKey(request)] = result as GraphQLResult;
  });

  // A mock for the query method
  const queryMock = (request: Request) => {
    return new Promise((resolve, reject) => {
      const resultData = requestToResultMap[requestToKey(request)];

      if (! resultData) {
        throw new Error(`Passed request that wasn't mocked: ${requestToKey(request)}`);
      }

      setTimeout(() => {
        resolve(resultData);
      }, 0);
    });
  };

  return {
    query: queryMock,
  } as NetworkInterface;
}

function requestToKey(request: Request): string {
  const query = request.query && print(parse(request.query));

  return JSON.stringify({
    variables: request.variables,
    debugName: request.debugName,
    query,
  });
}

function testDiffing(
  queryArray: {
    // The query the UI asks for
    query: string,

    // The query that we expect to be sent to the server
    diffedQuery: string,

    // The response the server would return for the diffedQuery
    diffedQueryResponse: any,

    // The result the actual UI receives, after all data is fetched
    fullResponse: any,

    // Variables to use in all queries
    variables?: Object,
  }[],
  done: () => void
) {
  const networkInterface = mockNetworkInterface(queryArray.map(({
    diffedQuery,
    diffedQueryResponse,
    variables = {},
  }) => {
    return {
      request: { query: diffedQuery, variables },
      result: { data: diffedQueryResponse },
    };
  }));

  const queryManager = new QueryManager({
    networkInterface,
    store: createApolloStore(),
  });

  const steps = queryArray.map(({ query, fullResponse, variables }) => {
    return (cb) => {
      const handle = queryManager.watchQuery({
        query,
        variables,
        forceFetch: false,
      });

      handle.onResult((result) => {
        assert.deepEqual(result.data, fullResponse);
        cb();
        handle.stop();
      });
    };
  });

  series(steps, (err, res) => {
    if (err) {
      throw err;
    }

    done();
  });
}
