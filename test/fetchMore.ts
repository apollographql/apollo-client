import * as chai from 'chai';
const { assert } = chai;

import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient from '../src';

import assign = require('lodash.assign');
import clonedeep = require('lodash.clonedeep');

import gql from 'graphql-tag';

describe('fetchMore on an observable query', () => {
  const query = gql`
    query Comment($repoName: String!, $start: Int!, $limit: Int!) {
      entry(repoFullName: $repoName) {
        comments(start: $start, limit: $limit) {
          text
        }
      }
    }
  `;
  const variables = {
    repoName: 'org/repo',
    start: 0,
    limit: 10,
  };
  const variablesMore = assign({}, variables, { start: 10, limit: 10 });

  const result = {
    data: {
      entry: {
        comments: [],
      },
    },
  };
  const resultMore = clonedeep(result);
  for (let i = 1; i <= 10; i++) {
    result.data.entry.comments.push({ text: `comment ${i}` });
  }
  for (let i = 11; i <= 20; i++) {
    resultMore.data.entry.comments.push({ text: `comment ${i}` });
  }

  let latestResult = null;

  let client: ApolloClient;
  let networkInterface;

  function setup(...mockedResponses) {
    networkInterface = mockNetworkInterface({
      request: {
        query,
        variables,
      },
      result,
    }, ...mockedResponses);

    client = new ApolloClient({
      networkInterface,
    });

    const obsHandle = client.watchQuery({
      query,
      variables,
    });
    obsHandle.subscribe({
      next(queryResult) {
        // do nothing
        latestResult = queryResult;
      },
    });

    return Promise.resolve(obsHandle);
  };

  it('basic fetchMore results merging', () => {
    return setup({
      request: {
        query,
        variables: variablesMore,
      },
      result: resultMore,
    }).then((watchedQuery) => {
      return watchedQuery.fetchMore({
        variables: variablesMore,
        updateQuery: (prev, options) => {
          const state = clonedeep(prev) as any;
          state.entry.comments = [...state.entry.comments, ...(options.fetchMoreResult as any).data.entry.comments];
          return state;
        },
      });
    }).then(() => {
      const comments = latestResult.data.entry.comments;
      assert.lengthOf(comments, 20);
      for (let i = 1; i <= 20; i++) {
        assert.equal(comments[i - 1].text, `comment ${i}`);
      }
    });
  });
});
