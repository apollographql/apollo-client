import { assert } from 'chai';

import { diffQueryAgainstStore } from '../src/data/diffAgainstStore';
import { writeQueryToStore } from '../src/data/writeToStore';
import { printQueryForMissingData } from '../src/queryPrinting';

import {
  getIdField,
} from '../src/data/extensions';

import {
  NormalizedCache,
} from '../src/data/store';

import gql from '../src/gql';

describe('diffing queries against the store', () => {
  it('returns nothing when the store is enough', () => {
    const query = gql`
      {
        people_one(id: "1") {
          name
        }
      }
    `;

    const result = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result,
      query,
    });

    assert.isUndefined(diffQueryAgainstStore({
      store,
      query,
    }).missingSelectionSets);
  });

  it('works with multiple root queries', () => {
    const query = gql`
      {
        people_one(id: "1") {
          name
        }
        otherQuery
      }
    `;


    const store = {} as NormalizedCache;

    // Should return two root query selections
    assert.equal(diffQueryAgainstStore({
      store,
      query,
    }).missingSelectionSets[0].selectionSet.selections.length, 2);
  });

  it('when the store is missing one field and doesn\'t know IDs', () => {
    const firstQuery = gql`
      {
        people_one(id: "1") {
          __typename
          id
          name
        }
      }
    `;

    const result = {
      people_one: {
        __typename: 'Person',
        id: 'lukeId',
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result,
      query: firstQuery,
    });

    const secondQuery = gql`
      {
        people_one(id: "1") {
          name
          age
        }
      }
    `;

    const { missingSelectionSets } = diffQueryAgainstStore({
      store,
      query: secondQuery,
    });

    // XXX a more efficient diffing algorithm would actually only fetch `age` here. Something to
    // implement next
    assert.equal(printQueryForMissingData({
      missingSelectionSets,
    }), `{
  people_one(id: "1") {
    name
    age
  }
}
`);
  });

  it('caches root queries both under the ID of the node and the query name', () => {
    const firstQuery = gql`
      {
        people_one(id: "1") {
          __typename,
          id,
          name
        }
      }
    `;

    const result = {
      people_one: {
        __typename: 'Person',
        id: '1',
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result,
      query: firstQuery,
      dataIdFromObject: getIdField,
    });

    const secondQuery = gql`
      {
        people_one(id: "1") {
          __typename,
          id,
          name
        }
      }
    `;

    const { missingSelectionSets } = diffQueryAgainstStore({
      store,
      query: secondQuery,
    });

    assert.isUndefined(missingSelectionSets);
    assert.deepEqual(store['1'], result.people_one);
  });

  it('diffs root queries even when IDs are turned off', () => {
    const firstQuery = gql`
      {
        people_one(id: "1") {
          __typename,
          id,
          name
        }
      }
    `;

    const result = {
      people_one: {
        __typename: 'Person',
        id: '1',
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result,
      query: firstQuery,
      dataIdFromObject: getIdField,
    });

    const secondQuery = gql`
      {
        people_one(id: "1") {
          __typename
          id
          name
        }
        people_one(id: "2") {
          __typename
          id
          name
        }
      }
    `;

    const { missingSelectionSets } = diffQueryAgainstStore({
      store,
      query: secondQuery,
    });

    assert.equal(printQueryForMissingData({
      missingSelectionSets,
    }), `{
  people_one(id: "2") {
    __typename
    id
    name
  }
}
`);
    assert.deepEqual(store['1'], result.people_one);
  });

  it('works with inline fragments', () => {
    const firstQuery = gql`
      {
        people_one(id: "1") {
          __typename,
          ... on Person {
            id,
            name
          }
        }
      }
    `;

    const result = {
      people_one: {
        __typename: 'Person',
        id: '1',
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result,
      query: firstQuery,
      dataIdFromObject: getIdField,
    });

    const secondQuery = gql`
      {
        people_one(id: "1") {
          __typename
          ... on Person {
            id
            name
          }
        }
        people_one(id: "2") {
          __typename
          ... on Person {
            id
            name
          }
        }
      }
    `;

    const { missingSelectionSets } = diffQueryAgainstStore({
      store,
      query: secondQuery,
    });

    assert.equal(printQueryForMissingData({
      missingSelectionSets,
    }), `{
  people_one(id: "2") {
    __typename
    ... on Person {
      id
      name
    }
  }
}
`);
    assert.deepEqual(store['1'], result.people_one);
  });
});
