import * as chai from 'chai';
const { assert } = chai;

import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient, { addTypename, createFragment } from '../src';

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
  const variablesMore = assign({}, variables, { start: 10 });

  const result = {
    data: {
      entry: {
        comments: [],
      },
    },
  };
  for (let i = 1; i <= 10; i++) {
    result.data.entry.comments.push({ text: `comment ${i}` });
  }

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
      next(result) {
        // do nothing
      }
    });

    return Promise.resolve(obsHandle);
  };

  it('basic fetchMore results merging', () => {
    return setup({
      request: {
        query,
        variables: variablesMore,
      },
      result,
    }).then((watchedQuery) => {
      return watchedQuery.fetchMore({
        variables: variablesMore,
      }).then(() => {
        return watchedQuery;
      });
    }).then((watchedQuery) => {
      return watchedQuery.result();
    }).then((result) => {
      console.log(result);
      assert.equal(result, 'asdf');
    });
  });
});
