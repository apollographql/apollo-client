import * as chai from 'chai';
const { assert } = chai;

import {
  ApolloClient,
} from '../src';

import {
  GraphQLResult,
  GraphQLError,
  parse,
  print,
} from 'graphql';

import {
  rootReducer,
} from './fixtures/redux-todomvc';

import {
  Store,
} from '../src/store';

import {
  createStore,
  Store as ReduxStore,
} from 'redux';

import {
  createNetworkInterface,
  NetworkInterface,
  Request,
} from '../src/networkInterface';

import * as chaiAsPromised from 'chai-as-promised';

// make it easy to assert with promises
chai.use(chaiAsPromised);

describe('client', () => {
  it('does not require any arugments', () => {
    const client = new ApolloClient();
    assert.isDefined(client.apolloStore);
  });

  it('can allow passing in a network interface', () => {
    const networkInterface: NetworkInterface = createNetworkInterface('swapi');
    const client = new ApolloClient({
      networkInterface,
    });

    assert.equal(client.networkInterface._uri, networkInterface._uri);
  });

  it('can allow passing in a store', () => {
    const apolloStore: ReduxStore = createStore(rootReducer);

    const client = new ApolloClient({
      apolloStore,
    });

    assert.deepEqual(client.apolloStore.getState(), apolloStore.getState());
  });

  it('should allow for a single query to take place', (done) => {

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

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { data },
    });

    const client = new ApolloClient({
      networkInterface,
    });

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result, { data });
        done();
       });
  });

  it('should return errors correctly for a single query', (done) => {

    const query = `
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const errors: GraphQLError[] = [
      {
        name: 'test',
        message: 'Syntax Error GraphQL request (8:9) Expected Name, found EOF',
      },
    ];

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { errors },
    });

    const client = new ApolloClient({
      networkInterface,
    });

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result, { errors });
        done();
       });
  });

  it('should allow for subscribing to a request', (done) => {

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

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { data },
    });

    const client = new ApolloClient({
      networkInterface,
    });

    const handle = client.watchQuery({ query });

    handle.onResult((error, result) => {
      assert.deepEqual(result, data);
      done();
    });
  });

});

function mockNetworkInterface(
  mockedRequest: {
    request: Request,
    result: GraphQLResult,
  }
) {
  const requestToResultMap: any = {};
  const { request, result } = mockedRequest;

  // Populate set of mocked requests
  requestToResultMap[requestToKey(request)] = result as GraphQLResult;

  // A mock for the query method
  const queryMock = (req: Request) => {
    return new Promise((resolve, reject) => {
      const resultData = requestToResultMap[requestToKey(req)];
      if (!resultData) {
        throw new Error(`Passed request that wasn't mocked: ${requestToKey(req)}`);
      }
      resolve(resultData);
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
    query,
  });
}
