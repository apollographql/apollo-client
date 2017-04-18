import {
  mockSubscriptionNetworkInterface,
} from './mocks/mockNetworkInterface';

import {
  assert,
} from 'chai';

import { cloneDeep } from 'lodash';

import { isSubscriptionResultAction } from '../src/actions';

import ApolloClient from '../src';

import gql from 'graphql-tag';

import {
  QueryManager,
} from '../src/core/QueryManager';

import {
  createApolloStore,
} from '../src/store';

describe('GraphQL Subscriptions', () => {
  const results = ['Dahivat Pandya', 'Vyacheslav Kim', 'Changping Chen', 'Amanda Liu'].map(
    name => ({ result: { user: { name: name } }, delay: 10 }),
  );

  let sub1: any;
  let options: any;
  let watchQueryOptions: any;
  let sub2: any;
  let defaultOptions: any;
  let defaultSub1: any;
  let commentsQuery: any;
  let commentsVariables: any;
  let commentsSub: any;
  let commentsResult: any;
  let commentsResultMore: any;
  let commentsWatchQueryOptions: any;
  beforeEach(() => {

    sub1 = {
      request: {
        query: gql`
          subscription UserInfo($name: String) {
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
      results: [...results],
    };

    options = {
      query: gql`
        subscription UserInfo($name: String) {
          user(name: $name) {
            name
          }
        }
      `,
      variables: {
          name: 'Changping Chen',
        },
    };


    defaultSub1 = {
      request: {
        query: gql`
          subscription UserInfo($name: String = "Changping Chen") {
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
      results: [...results],
    };

    defaultOptions = {
      query: gql`
        subscription UserInfo($name: String = "Changping Chen") {
          user(name: $name) {
            name
          }
        }
      `,
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

    commentsQuery = gql`
      query Comment($repoName: String!) {
        entry(repoFullName: $repoName) {
          comments {
            text
          }
        }
      }
    `;

    commentsSub = gql`
      subscription getNewestComment($repoName: String!) {
        getNewestComment(repoName: $repoName) {
          text
        }
      }`;

    commentsVariables = {
      repoName: 'org/repo',
    };

    commentsWatchQueryOptions = {
      query: commentsQuery,
      variables: commentsVariables,
    };

    commentsResult = {
      data: {
        entry: {
          comments: [],
        },
      },
    };

    commentsResultMore = {
      result: {
        entry: {
          comments: [],
        },
      },
    };

    for (let i = 1; i <= 10; i++) {
      commentsResult.data.entry.comments.push({ text: `comment ${i}` });
    }

    for (let i = 11; i < 12; i++) {
      commentsResultMore.result.entry.comments.push({ text: `comment ${i}` });
    }

    sub2 = {
      request: {
        query: commentsSub,
        variables: commentsVariables,
      },
      id: 0,
      results: [commentsResultMore],
    };

  });


  it('should start a subscription on network interface and unsubscribe', (done) => {
    const network = mockSubscriptionNetworkInterface([defaultSub1]);
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      networkInterface: network,
      addTypename: false,
    });

    const sub = client.subscribe(defaultOptions).subscribe({
      next(result) {
        assert.deepEqual(result, results[0].result);

        // Test unsubscribing
        sub.unsubscribe();
        assert.equal(Object.keys(network.mockedSubscriptionsById).length, 0);

        done();
      },
    });

    const id = (sub as any)._networkSubscriptionId;
    network.fireResult(id);

    assert.equal(Object.keys(network.mockedSubscriptionsById).length, 1);
  });

  it('should subscribe with default values', (done) => {
    const network = mockSubscriptionNetworkInterface([sub1]);
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      networkInterface: network,
      addTypename: false,
    });

    const sub = client.subscribe(options).subscribe({
      next(result) {
        assert.deepEqual(result, results[0].result);

        // Test unsubscribing
        sub.unsubscribe();
        assert.equal(Object.keys(network.mockedSubscriptionsById).length, 0);

        done();
      },
    });

    const id = (sub as any)._networkSubscriptionId;
    network.fireResult(id);

    assert.equal(Object.keys(network.mockedSubscriptionsById).length, 1);
  });

  it('should multiplex subscriptions', (done) => {
    const network = mockSubscriptionNetworkInterface([sub1]);
    const queryManager = new QueryManager({
      networkInterface: network,
      reduxRootSelector: (state: any) => state.apollo,
      store: createApolloStore(),
      addTypename: false,
    });

    const obs = queryManager.startGraphQLSubscription(options);

    let counter = 0;

    const sub = obs.subscribe({
      next(result) {
        assert.deepEqual(result, results[0].result);
        counter++;
        if (counter === 2) {
          done();
        }
      },
    }) as any;

    // Subscribe again. Should also receive the same result.
    const resub = obs.subscribe({
      next(result) {
        assert.deepEqual(result, results[0].result);
        counter++;
        if (counter === 2) {
          done();
        }
      },
    }) as any;

    const id = sub._networkSubscriptionId;
    network.fireResult(id);
  });

  it('should receive multiple results for a subscription', (done) => {
    const network = mockSubscriptionNetworkInterface([sub1]);
    let numResults = 0;
    const queryManager = new QueryManager({
      networkInterface: network,
      reduxRootSelector: (state: any) => state.apollo,
      store: createApolloStore(),
      addTypename: false,
    });

    const sub = queryManager.startGraphQLSubscription(options).subscribe({
      next(result) {
        assert.deepEqual(result, results[numResults].result);
        numResults++;
        if (numResults === 4) {
          done();
        }
      },
    }) as any;

    const id = sub._networkSubscriptionId;

    for (let i = 0; i < 4; i++) {
      network.fireResult(id);
    }
  });

  it('should fire redux action and call result reducers', (done) => {
    const query = gql`
      query miniQuery {
        number
      }
    `;

    const res = {
      data: {
        number: 0,
      },
    };

    const req1 = {
      request: { query },
      result: res,
    };

    const network = mockSubscriptionNetworkInterface([sub1], req1);
    let numResults = 0;
    let counter = 0;
    const queryManager = new QueryManager({
      networkInterface: network,
      reduxRootSelector: (state: any) => state.apollo,
      store: createApolloStore(),
      addTypename: false,
    });

    const observableQuery = queryManager.watchQuery({
      query,
      reducer: (previousResult, action) => {
        counter++;
        if (isSubscriptionResultAction(action)) {
          const newResult = cloneDeep(previousResult) as any;
          newResult.number++;
          return newResult;
        }
        return previousResult;
      },
    }).subscribe({
      next: () => null,
    });

    const sub = queryManager.startGraphQLSubscription(options).subscribe({
      next(result) {
        assert.deepEqual(result, results[numResults].result);
        numResults++;
        if (numResults === 4) {
          // once for itself, four times for the subscription results.
          observableQuery.unsubscribe();
          assert.equal(counter, 5);
          assert.equal(queryManager.store.getState()['apollo']['data']['ROOT_QUERY']['number'], 4);
          done();
        }
      },
    }) as any;

    const id = sub._networkSubscriptionId;

    for (let i = 0; i < 4; i++) {
      network.fireResult(id);
    }
  });
});
