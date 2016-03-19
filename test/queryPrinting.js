/* eslint quote-props:0 */

import { assert } from 'chai';
import { selectionSetToNodeQueryDefinition } from '../src/selectionSetToQuery';

describe('printing queries', () => {
  it('converts selection set to a query string', () => {
    const id = 'lukeId';
    const typeName = 'Person';
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
      typeName,
      selectionSet,
    }), `{
  node(id: "lukeId") {
    ... on Person {
      age
    }
  }
}
`);
  });
});
