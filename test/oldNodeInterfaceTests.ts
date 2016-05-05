import { assert } from 'chai';

import { diffQueryAgainstStore } from '../src/data/diffAgainstStore';
import { writeQueryToStore } from '../src/data/writeToStore';
import { stripLoc } from '../src/data/debug';
import { printQueryForMissingData } from '../src/queryPrinting';

import {
  getIdField,
} from '../src/data/extensions';

import gql from '../src/gql';

describe('diffing queries against the store', () => {
  it('when the store is missing one field and knows about IDs', () => {
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
      dataIdFromObject: getIdField,
    });

    const secondQuery = gql`
      {
        people_one(id: "1") {
          name,
          age
        }
      }
    `;

    assert.deepEqual(stripLoc(diffQueryAgainstStore({
      store,
      query: secondQuery,
      dataIdFromObject: getIdField,
    }).missingSelectionSets), [
      {
        id: 'lukeId',
        typeName: 'Person',
        selectionSet: {
          kind: 'SelectionSet',
          selections: [
            {
              'kind': 'Field',
              'alias': null,
              'arguments': [],
              'directives': [],
              'name': {
                'kind': 'Name',
                'value': 'age',
              },
              'selectionSet': null,
            },
          ],
        },
      },
    ]);
  });

  it('when the store is missing one field and knows about IDs', () => {
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
        id: 'lukeId',
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
          name,
          age
        }
      }
    `;

    const { missingSelectionSets } = diffQueryAgainstStore({
      store,
      query: secondQuery,
      dataIdFromObject: getIdField,
    });

    assert.equal(printQueryForMissingData({
      missingSelectionSets,
    }), `{
  __node_0: node(id: "lukeId") {
    id
    ... on Person {
      age
    }
  }
}
`);
  });

 it('when the store is missing multiple nodes', () => {
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
        id: 'lukeId',
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
          name,
          age
        }
        people_one(id: "4") {
          name,
          age
        }
      }
    `;

    const { missingSelectionSets } = diffQueryAgainstStore({
      store,
      query: secondQuery,
      dataIdFromObject: getIdField,
    });

    assert.equal(printQueryForMissingData({
      missingSelectionSets,
    }), `{
  __node_0: node(id: "lukeId") {
    id
    ... on Person {
      age
    }
  }
  people_one(id: "4") {
    name
    age
  }
}
`);
  });
});
