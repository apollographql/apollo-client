import { assert } from 'chai';
import { parseSelectionSet } from './util/graphqlAST';
import { createMockGraphPrimitives } from './mocks/mockGraphPrimitives';
import { readFromGraph } from '../src/graph/read';

describe('reading from the store 2', () => {
  it('runs a basic query', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {},
      },
    });

    const queryResult = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          stringField,
          numberField
        }
      `),
    });

    assert.deepEqual(queryResult, {
      stale: false,
      data: {
        stringField: 'This is a string!',
        numberField: 5,
      },
    });
  });

  it('runs a basic query with arguments', () => {
    const selectionSet = parseSelectionSet(`
      query {
        id,
        stringField(arg: $stringArg),
        numberField(intArg: $intArg, floatArg: $floatArg),
        nullField
      }
    `);

    const variables = {
      intArg: 5,
      floatArg: 3.14,
      stringArg: 'This is a string!',
    };

    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          nullField: null,
          'numberField({"intArg":5,"floatArg":3.14})': 5,
          'stringField({"arg":"This is a string!"})': 'Heyo',
        },
        references: {},
      },
    });

    const result = readFromGraph({
      graph,
      id: 'root',
      selectionSet,
      variables,
    });

    assert.deepEqual(result, {
      stale: false,
      data: {
        id: 'abcd',
        nullField: null,
        numberField: 5,
        stringField: 'Heyo',
      },
    });
  });

  it('runs a nested query', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedObj: 'abcde',
        },
      },
      abcde: {
        scalars: {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
    });

    const result = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          stringField,
          numberField,
          nestedObj {
            stringField,
            numberField
          }
        }
      `),
    });

    assert.deepEqual(result, {
      stale: false,
      data: {
        stringField: 'This is a string!',
        numberField: 5,
        nestedObj: {
          stringField: 'This is a string too!',
          numberField: 6,
        },
      },
    });
  });

  it('runs a nested query with multiple fragments', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedObj: 'abcde',
          nullObject: null,
        },
      },
      abcde: {
        scalars: {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {
          deepNestedObj: 'abcdef',
        },
      },
      abcdef: {
        scalars: {
          stringField: 'This is a deep string',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });

    const queryResult = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          stringField,
          numberField,
          nullField,
          ... on Query {
            nestedObj {
              stringField
              nullField
              deepNestedObj {
                stringField
                nullField
              }
            }
          }
          ... on Query {
            nestedObj {
              numberField
              nullField
              deepNestedObj {
                numberField
                nullField
              }
            }
          }
          ... on Query {
            nullObject {
              nestedNullField
            }
          }
        }
      `),
    });

    assert.deepEqual(queryResult, {
      stale: false,
      data: {
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedObj: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
          deepNestedObj: {
            stringField: 'This is a deep string',
            numberField: 7,
            nullField: null,
          },
        },
        nullObject: null,
      },
    });
  });

  it('runs a nested query with an array without IDs', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: [
            'abcd.nestedArray.0',
            'abcd.nestedArray.1',
          ],
        },
      },
      'abcd.nestedArray.0': {
        scalars: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
      'abcd.nestedArray.1': {
        scalars: {
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });

    const queryResult = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          stringField,
          numberField,
          nestedArray {
            stringField,
            numberField
          }
        }
      `),
    });

    assert.deepEqual(queryResult, {
      stale: false,
      data: {
        stringField: 'This is a string!',
        numberField: 5,
        nestedArray: [
          {
            stringField: 'This is a string too!',
            numberField: 6,
          },
          {
            stringField: 'This is a string also!',
            numberField: 7,
          },
        ],
      },
    });
  });

  it('runs a nested query with an array without IDs and a null', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: [
            null,
            'abcd.nestedArray.1',
          ],
        },
      },
      'abcd.nestedArray.1': {
        scalars: {
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });

    const queryResult = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          stringField,
          numberField,
          nestedArray {
            stringField,
            numberField
          }
        }
      `),
    });

    assert.deepEqual(queryResult, {
      stale: false,
      data: {
        stringField: 'This is a string!',
        numberField: 5,
        nestedArray: [
          null,
          {
            stringField: 'This is a string also!',
            numberField: 7,
          },
        ],
      },
    });
  });

  it('runs a nested query with an array with IDs and a null', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: [
            null,
            'abcde',
          ],
        },
      },
      abcde: {
        scalars: {
          id: 'abcde',
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });

    const queryResult = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          stringField,
          numberField,
          nestedArray {
            id,
            stringField,
            numberField
          }
        }
      `),
    });

    assert.deepEqual(queryResult, {
      stale: false,
      data: {
        stringField: 'This is a string!',
        numberField: 5,
        nestedArray: [
          null,
          {
            id: 'abcde',
            stringField: 'This is a string also!',
            numberField: 7,
          },
        ],
      },
    });
  });

  it('throws on a missing field', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {},
      },
    });

    assert.throws(() => {
      readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`
          {
            stringField
            missingField
          }
        `),
      });
    }, 'No scalar value found for field \'missingField\'.');
  });

  it('runs a nested query where the reference is null', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedObj: null,
        },
      },
    });

    const queryResult = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          stringField,
          numberField,
          nestedObj {
            stringField,
            numberField
          }
        }
      `),
    });

    assert.deepEqual(queryResult, {
      stale: false,
      data: {
        stringField: 'This is a string!',
        numberField: 5,
        nestedObj: null,
      },
    });
  });

  it('runs an array of non-objects', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
          simpleArray: ['one', 'two', 'three'],
        },
        references: {},
      },
    });

    const queryResult = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          stringField,
          numberField,
          simpleArray
        }
      `),
    });

    assert.deepEqual(queryResult, {
      stale: false,
      data: {
        stringField: 'This is a string!',
        numberField: 5,
        simpleArray: ['one', 'two', 'three'],
      },
    });
  });

  it('runs an array of non-objects with null', () => {
    const graph = createMockGraphPrimitives({
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
          simpleArray: [null, 'two', 'three'],
        },
        references: {},
      },
    });

    const queryResult = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          stringField,
          numberField,
          simpleArray
        }
      `),
    });

    assert.deepEqual(queryResult, {
      stale: false,
      data: {
        stringField: 'This is a string!',
        numberField: 5,
        simpleArray: [null, 'two', 'three'],
      },
    });
  });
});
