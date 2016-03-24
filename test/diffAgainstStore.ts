import { assert } from 'chai';

import { diffQueryAgainstStore } from '../src/diffAgainstStore';
import { writeQueryToStore } from '../src/writeToStore';
import { stripLoc } from '../src/debug';
import { printNodeQuery } from '../src/queryPrinting';

describe('diffing queries against the store', () => {
  it('returns nothing when the store is enough', () => {
    const query = `
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

    assert.deepEqual(diffQueryAgainstStore({
      store,
      query,
    }).missingSelectionSets, []);
  });

  it('returns correct selection set when the store is missing one field', () => {
    const firstQuery = `
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

    const secondQuery = `
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

  it('generates the right query when the store is missing one field', () => {
    const firstQuery = `
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
    });

    const secondQuery = `
      {
        people_one(id: "1") {
          name,
          age
        }
      }
    `;

    const diffedSelectionSet = diffQueryAgainstStore({
      store,
      query: secondQuery,
    }).missingSelectionSets[0];

    assert.equal(printNodeQuery(diffedSelectionSet), `{
  node(id: "lukeId") {
    ... on Person {
      age
    }
  }
}
`);
  });
});
