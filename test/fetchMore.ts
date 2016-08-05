import * as chai from 'chai';
const { assert } = chai;

import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient from '../src';

import assign = require('lodash.assign');
import clonedeep = require('lodash.clonedeep');

import gql from 'graphql-tag';

describe('updateQuery on a simple query', () => {
  const query = gql`
    query thing {
      entry {
        value
      }
    }
  `;
  const result = {
    data: {
      entry: {
        value: 1,
      },
    },
  };

  it('triggers new result from updateQuery', () => {
    let latestResult = null;
    const networkInterface = mockNetworkInterface({
      request: { query },
      result,
    });

    const client = new ApolloClient({
      networkInterface,
    });

    const obsHandle = client.watchQuery({
      query,
    });
    const sub = obsHandle.subscribe({
      next(queryResult) {
        // do nothing
        latestResult = queryResult;
      },
    });

    return new Promise((resolve) => setTimeout(resolve))
      .then(() => obsHandle)
      .then((watchedQuery) => {
        assert.equal(latestResult.data.entry.value, 1);
        watchedQuery.updateQuery((prevResult) => {
          const res = clonedeep(prevResult);
          res.entry.value = 2;
          return res;
        });

        assert.equal(latestResult.data.entry.value, 2);
      })
      .then(() => sub.unsubscribe());
  });
});

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
  const query2 = gql`
    query NewComments($start: Int!, $limit: Int!) {
      comments(start: $start, limit: $limit) {
        text
      }
    }
  `;
  const variables = {
    repoName: 'org/repo',
    start: 0,
    limit: 10,
  };
  const variablesMore = assign({}, variables, { start: 10, limit: 10 });
  const variables2 = {
    start: 10,
    limit: 20,
  };

  const result = {
    data: {
      entry: {
        comments: [],
      },
    },
  };
  const resultMore = clonedeep(result);
  const result2 = {
    data: {
      comments: [],
    },
  };
  for (let i = 1; i <= 10; i++) {
    result.data.entry.comments.push({ text: `comment ${i}` });
  }
  for (let i = 11; i <= 20; i++) {
    resultMore.data.entry.comments.push({ text: `comment ${i}` });
    result2.data.comments.push({ text: `new comment ${i}` });
  }

  let latestResult = null;

  let client: ApolloClient;
  let networkInterface;
  let sub;

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
    sub = obsHandle.subscribe({
      next(queryResult) {
        // do nothing
        latestResult = queryResult;
      },
    });

    return Promise.resolve(obsHandle);
  };

  function unsetup() {
    sub.unsubscribe();
    sub = null;
  }

  it('basic fetchMore results merging', () => {
    latestResult = null;
    return setup({
      request: {
        query,
        variables: variablesMore,
      },
      result: resultMore,
    }).then((watchedQuery) => {
      return watchedQuery.fetchMore({
        variables: { start: 10 }, // rely on the fact that the original variables had limit: 10
        updateQuery: (prev, options) => {
          const state = clonedeep(prev) as any;
          state.entry.comments = [...state.entry.comments, ...(options.fetchMoreResult as any).data.entry.comments];
          return state;
        },
      });
    }).then(data => {
      assert.lengthOf(data.data.entry.comments, 10); // this is the server result
      assert.isFalse(data.loading);
      const comments = latestResult.data.entry.comments;
      assert.lengthOf(comments, 20);
      for (let i = 1; i <= 20; i++) {
        assert.equal(comments[i - 1].text, `comment ${i}`);
      }
      unsetup();
    });
  });

  it('fetching more with a different query', () => {
    latestResult = null;
    return setup({
      request: {
        query: query2,
        variables: variables2,
      },
      result: result2,
    }).then((watchedQuery) => {
      return watchedQuery.fetchMore({
        query: query2,
        variables: variables2,
        updateQuery: (prev, options) => {
          const state = clonedeep(prev) as any;
          state.entry.comments = [...state.entry.comments, ...(options.fetchMoreResult as any).data.comments];
          return state;
        },
      });
    }).then(() => {
      const comments = latestResult.data.entry.comments;
      assert.lengthOf(comments, 20);
      for (let i = 1; i <= 10; i++) {
        assert.equal(comments[i - 1].text, `comment ${i}`);
      }
      for (let i = 11; i <= 20; i++) {
        assert.equal(comments[i - 1].text, `new comment ${i}`);
      }
      unsetup();
    });
  });
});
