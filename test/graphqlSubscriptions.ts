import {
  mockSubscriptionNetworkInterface,
} from './mocks/mockNetworkInterface';

import {
  assert,
} from 'chai';

import clonedeep = require('lodash.clonedeep');

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
      user: {name: 'Dhaivat Pandya'},
    },
    delay: 10,
  };

  const result2 = {
    result: {
      user: {name: 'Vyacheslav Kim'},
    },
    delay: 10,
  };

  const result3 = {
    result: {
      user: {name: 'Changping Chen'},
    },
    delay: 10,
  };

  const result4 = {
    result: {
      user: {name: 'Amanda Liu'},
    },
    delay: 10,
  };
  let sub1;
  let options;
  let watchQueryOptions;
  let sub2;
  let commentsQuery;
  let commentsVariables;
  let commentsSub;
  let commentsResult;
  let commentsResultMore;
  let commentsWatchQueryOptions;
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
      results: [result1, result2, result3, result4],
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
    const network = mockSubscriptionNetworkInterface([sub2], {
      request: {
        query: commentsQuery,
        variables: commentsVariables,
      },
      result: commentsResult, // list of 10 comments
    });
    const client = new ApolloClient({
      networkInterface: network,
    });
    client.query({
      query: commentsQuery,
      variables: commentsVariables,
    }).then(() => {
      const graphQLSubscriptionOptions = {
        subscription: commentsSub,
        updateFunction: (prev, updateOptions) => {
          const state = clonedeep(prev) as any;
          // prev is that data field of the query result
          // updateOptions.subscriptionResult is the result entry from the subscription result
          state.entry.comments = [...state.entry.comments, ...(updateOptions.subscriptionResult as any).entry.comments];
          return state;
        },
      };
      const obsHandle = client.watchQuery(commentsWatchQueryOptions, graphQLSubscriptionOptions);

      obsHandle.subscribe({
        next(result) {
          let expectedComments = [];
          for (let i = 1; i <= 11; i++) {
            expectedComments.push({ text: `comment ${i}` });
          }
          assert.equal(result.data.entry.comments.length, 11);
          assert.deepEqual(result.data.entry.comments, expectedComments);
          done();
        },
      });

      const id = obsHandle.startGraphQLSubscription(graphQLSubscriptionOptions);
      network.fireResult(id);
    });
  });
});
