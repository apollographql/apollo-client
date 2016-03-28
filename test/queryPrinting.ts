import { assert } from 'chai';
import { printQueryForMissingData } from '../src/queryPrinting';

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
    assert.equal(printQueryForMissingData([
      {
        id,
        typeName,
        selectionSet,
      },
    ]), `{
  __node_0: node(id: "lukeId") {
    id
    ... on Person {
      age
    }
  }
}
`);
  });
});
