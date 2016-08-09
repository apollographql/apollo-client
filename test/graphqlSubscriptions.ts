import {
  mockSubscriptionNetworkInterface,
} from './mocks/mockNetworkInterface';

import {
  assert,
} from 'chai';

import ApolloClient from '../src';

import gql from 'graphql-tag';

import {
  QueryManager,
} from '../src/QueryManager';

import {
  createApolloStore,
} from '../src/store';

describe('GraphQL Subscriptions', () => {
  const result1 = {
    result: {
      data: {user: {name: 'Dhaivat Pandya'}},
    },
    delay: 10,
  };

  const result2 = {
    result: {
      data: {user: {name: 'Vyacheslav Kim'}},
    },
    delay: 10,
  };

  const result3 = {
    result: {
      data: {user: {name: 'Changping Chen'}},
    },
    delay: 10,
  };

  const result4 = {
    result: {
      data: {user: {name: 'Amanda Liu'}},
    },
    delay: 10,
  };
  let sub1;
  let options;
  let watchQueryOptions;
  beforeEach(() => {

    sub1 = {
      request: {
        query: gql`
          query UserInfo($name: String) {
            user(name: $name) {
              name
            }
          }
        `,
        variables: {
          name: 'Changping Chen',
        },
      },
      id: 0,
      results: [result1, result2, result3, result4],
    };

    options = {
      query: gql`
        query UserInfo($name: String) {
          user(name: $name) {
            name
          }
        }
      `,
      variables: {
          name: 'Changping Chen',
        },
      handler: (error, result) => {
        // do nothing
      },
    };

    watchQueryOptions = {
      query: gql`
        query UserInfo($name: String) {
          user(name: $name) {
            name
          }
        }
      `,
      variables: {
        name: 'Changping Chen',
      },
    };
  });


  it('should start a subscription on network interface', (done) => {
    const network = mockSubscriptionNetworkInterface([sub1]);
    const queryManager = new QueryManager({
      networkInterface: network,
      reduxRootKey: 'apollo',
      store: createApolloStore(),
    });
    options.handler = (error, result) => {
      assert.deepEqual(result, result1.result);
      done();
    };
    const id = queryManager.startSubscription(options);
    network.fireResult(id);
  });

  it('should receive multiple results for a subscription', (done) => {
    const network = mockSubscriptionNetworkInterface([sub1]);
    let numResults = 0;
    const queryManager = new QueryManager({
      networkInterface: network,
      reduxRootKey: 'apollo',
      store: createApolloStore(),
    });
    options.handler = (error, result) => {
      numResults++;
      if (numResults === 1) {
        assert.deepEqual(result, result1.result);
      } else if (numResults === 2) {
        assert.deepEqual(result, result2.result);
      } else if (numResults === 3) {
        assert.deepEqual(result, result3.result);
      } else if (numResults === 4) {
        assert.deepEqual(result, result4.result);
        done();
      } else {
        assert(false);
      }
    };
    const id = queryManager.startSubscription(options);
    for (let i = 0; i < 4; i++) {
      network.fireResult(id);
    }
  });

  it('should work with an observable query', (done) => {
    const network = mockSubscriptionNetworkInterface([sub1], {
      request: {
        query: gql`
          query UserInfo($name: String) {
            user(name: $name) {
              name
            }
          }
        `,
        variables: {
          name: 'Changping Chen',
        },
      },
      result: {
        data: {
          user: {
            name: 'Changping Chen',
          },
        },
      },
    });
    const client = new ApolloClient({
      networkInterface: network,
    });
    const obsHandle = client.watchQuery(watchQueryOptions, true);
    let numResults = 0;
    obsHandle.subscribe({
      next(result) {
        numResults++;
        if (numResults === 2) {
          assert.deepEqual(result.data, result1.result.data);
        } else if (numResults === 3) {
          assert.deepEqual(result.data, result2.result.data);
        } else if (numResults === 4) {
          assert.deepEqual(result.data, result3.result.data);
        } else if (numResults === 5) {
          assert.deepEqual(result.data, result4.result.data);
          done();
        } else {
          assert(false);
        }
      },
    });
    const id = obsHandle.startGraphQLSubscription();
    for (let i = 0; i < 4; i++) {
      network.fireResult(id);
    }
  });


});
