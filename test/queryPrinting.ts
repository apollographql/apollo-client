import { assert } from 'chai';
import { printNodeQuery } from '../src/queryPrinting';

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
    assert.equal(printNodeQuery({
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
