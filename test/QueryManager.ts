import {
  QueryManager,
} from '../src/QueryManager';

import {
  NetworkInterface,
  Request,
} from '../src/networkInterface';

import {
  Store,
  createApolloStore,
} from '../src/store';

import {
  parseFragment,
} from '../src/parser';

import {
  assert,
} from 'chai';

import {
  GraphQLResult,
} from 'graphql';

describe('QueryManager', () => {
  it('works with one query', (done) => {
    const queryManager = new QueryManager({
      networkInterface: {} as NetworkInterface,
      store: createApolloStore(),
    });

    const fragmentDef = parseFragment(`
      fragment FragmentName on Item {
        id
        stringField
        numberField
        nullField
      }
    `);

    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    const handle = queryManager.watchSelectionSet({
      rootId: 'abcd',
      typeName: 'Person',
      selectionSet: fragmentDef.selectionSet,
    });

    handle.onData((res) => {
      assert.deepEqual(res, result);
      done();
    });

    const store = {
      abcd: result,
    } as Store;

    queryManager.broadcastNewStore(store);
  });

  it('works with two queries', (done) => {
    const queryManager = new QueryManager({
      networkInterface: {} as NetworkInterface,
      store: createApolloStore(),
    });

    const fragment1Def = parseFragment(`
      fragment FragmentName on Item {
        id
        numberField
        nullField
      }
    `);

    const fragment2Def = parseFragment(`
      fragment FragmentName on Item {
        id
        stringField
        nullField
      }
    `);

    const handle1 = queryManager.watchSelectionSet({
      rootId: 'abcd',
      typeName: 'Person',
      selectionSet: fragment1Def.selectionSet,
    });

    const handle2 = queryManager.watchSelectionSet({
      rootId: 'abcd',
      typeName: 'Person',
      selectionSet: fragment2Def.selectionSet,
    });

    let numDone = 0;

    handle1.onData((res) => {
      assert.deepEqual(res, {
        id: 'abcd',
        numberField: 5,
        nullField: null,
      });
      numDone++;
      if (numDone === 2) {
        done();
      }
    });

    handle2.onData((res) => {
      assert.deepEqual(res, {
        id: 'abcd',
        stringField: 'This is a string!',
        nullField: null,
      });
      numDone++;
      if (numDone === 2) {
        done();
      }
    });

    const store = {
      abcd: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
      },
    } as Store;

    queryManager.broadcastNewStore(store);
  });

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

    handle.onData((result) => {
      assert.deepEqual(result, {
        allPeople: {
          people: [
            {
              name: 'Luke Skywalker',
            },
          ],
        },
      });

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

    handle.onError((error) => {
      assert.equal(error[0].message, 'This is an error message.');

      assert.throws(() => {
        handle.onData((result) => null);
      }, /Query was stopped. Please create a new one./);

      done();
    });
  });

  it('runs a mutation', (done) => {
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

    queryManager.mutate({
      mutation,
    }).then((resultData) => {
      assert.deepEqual(resultData, data);
      done();
    }).catch((err) => {
      console.error(err);
      throw err;
    });
  });

  it('runs a mutation and puts the result in the store', (done) => {
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

    queryManager.mutate({
      mutation,
    }).then((resultData) => {
      assert.deepEqual(resultData, data);

      // Make sure we updated the store with the new data
      assert.deepEqual(store.getState()['5'], { id: '5', isPrivate: true });
      done();
    }).catch((err) => {
      console.error(err);
      throw err;
    });
  });
});

function mockNetworkInterface(
  requestsResults: { request: Request, result: GraphQLResult }[]
) {
  const requestToResultMap = {};

  requestsResults.forEach(({request, result}) => {
    requestToResultMap[JSON.stringify(request)] = result;
  });

  const queryMock = (requests: Request[]) => {
    return Promise.all(requests.map((request) => {
      return new Promise((resolve, reject) => {
        const result = requestToResultMap[JSON.stringify(request)];

        if (! result) {
          throw new Error(`Passed request that wasn't mocked: ${JSON.stringify(request)}`);
        }

        if (result.data) {
          resolve(result);
        } else {
          reject(result.errors);
        }
      });
    }));
  };

  return {
    query: queryMock,
  } as NetworkInterface;
}
