/* eslint quote-props:0 */

import { assert } from 'chai';

import { diffQueryAgainstStore } from '../src/diffAgainstStore';
import { writeQueryToStore } from '../src/writeToStore';
import { stripLoc } from '../src/debug';
import { selectionSetToNodeQueryDefinition } from '../src/selectionSetToQuery';

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
          id,
          name
        }
      }
    `;

    const result = {
      people_one: {
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

  it('converts selection set to a query string', () => {
    const id = 'lukeId';
    const selectionSet = {
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
    };

    // Note - the indentation inside template strings is meaningful!
    assert.equal(selectionSetToNodeQueryDefinition({
      id,
      selectionSet,
    }), `{
  node(id: "lukeId") {
    age
  }
}
`);
  });
});
