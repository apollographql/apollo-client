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
} from '../src/core/QueryManager';

import {
  createApolloStore,
} from '../src/store';

describe('GraphQL Subscriptions', () => {
  const results = ['Dahivat Pandya', 'Vyacheslav Kim', 'Changping Chen', 'Amanda Liu'].map(
    name => ({ result: { user: { name: name } }, delay: 10 })
  );

  let sub1: any;
  let options: any;
  let watchQueryOptions: any;
  let sub2: any;
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
      handler: (error: any, result: any) => {
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
    const network = mockSubscriptionNetworkInterface([sub1]);
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      networkInterface: network,
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
    obs.subscribe({
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

  // it('should work with an observable query', (done) => {
  //   const network = mockSubscriptionNetworkInterface([sub2], {
  //     request: {
  //       query: commentsQuery,
  //       variables: commentsVariables,
  //     },
  //     result: commentsResult, // list of 10 comments
  //   });
  //   const client = new ApolloClient({
  //     networkInterface: network,
  //   });
  //   client.query({
  //     query: commentsQuery,
  //     variables: commentsVariables,
  //   }).then(() => {
  //     const graphQLSubscriptionOptions = {
  //       subscription: commentsSub,
  //       variables: commentsVariables,
  //       updateQuery: (prev, updateOptions) => {
  //         const state = clonedeep(prev) as any;
  //         // prev is that data field of the query result
  //         // updateOptions.subscriptionResult is the result entry from the subscription result
  //         state.entry.comments = [...state.entry.comments, ...(updateOptions.subscriptionResult as any).entry.comments];
  //         return state;
  //       },
  //     };
  //     const obsHandle = client.watchQuery(commentsWatchQueryOptions);

  //     obsHandle.subscribe({
  //       next(result) {
  //         let expectedComments = [];
  //         for (let i = 1; i <= 11; i++) {
  //           expectedComments.push({ text: `comment ${i}` });
  //         }
  //         assert.equal(result.data.entry.comments.length, 11);
  //         assert.deepEqual(result.data.entry.comments, expectedComments);
  //         done();
  //       },
  //     });

  //     const id = obsHandle.startGraphQLSubscription(graphQLSubscriptionOptions);
  //     network.fireResult(id);
  //   });
  // });

  // TODO: test that we can make two subscriptions one one watchquery.

});
