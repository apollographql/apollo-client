import { assert } from 'chai';
import { parseSelectionSet } from './util/graphqlAST';
import { createMockGraphPrimitives } from './mocks/mockGraphPrimitives';
import { writeToGraph } from '../src/graph/write';

describe('writing to the store 2', () => {
  it('properly normalizes a trivial item', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
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
  });

  it('properly normalizes an aliased field', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          aliasedField: stringField,
          numberField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        aliasedField: 'This is a string!',
        numberField: 5,
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
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
  });

  it('properly normalizes a aliased fields with arguments', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          aliasedField1: stringField(arg: 1),
          aliasedField2: stringField(arg: 2),
          numberField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        aliasedField1: 'The arg was 1!',
        aliasedField2: 'The arg was 2!',
        numberField: 5,
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          'stringField({"arg":1})': 'The arg was 1!',
          'stringField({"arg":2})': 'The arg was 2!',
          numberField: 5,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a query with variables', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      variables: {
        intArg: 5,
        floatArg: 3.14,
        stringArg: 'This is a string!',
      },
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField(arg: $stringArg),
          numberField(intArg: $intArg, floatArg: $floatArg),
          nullField
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'Heyo',
        numberField: 5,
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
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
  });

  it('properly normalizes a nested object with an ID', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          nestedObj {
            id,
            stringField,
            numberField,
            nullField
          }
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedObj: {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
      },
      getDataID: ({ id }: { id: string }) => id,
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedObj: '(abcde)',
        },
      },
      '(abcde)': {
        scalars: {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested object without an ID', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          nestedObj {
            stringField,
            numberField,
            nullField
          }
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedObj: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedObj: 'root.nestedObj',
        },
      },
      'root.nestedObj': {
        scalars: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested object with arguments but without an ID', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          nestedObj(arg: "val") {
            stringField,
            numberField,
            nullField
          }
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedObj: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          'nestedObj({"arg":"val"})': 'root.nestedObj({"arg":"val"})',
        },
      },
      'root.nestedObj({"arg":"val"})': {
        scalars: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested array with IDs', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          nestedArray {
            id,
            stringField,
            numberField,
            nullField
          }
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedArray: [
          {
            id: 'abcde',
            stringField: 'This is a string too!',
            numberField: 6,
            nullField: null,
          },
          {
            id: 'abcdef',
            stringField: 'This is a string also!',
            numberField: 7,
            nullField: null,
          },
        ],
      },
      getDataID: ({ id }: { id: string }) => id,
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: [
            '(abcde)',
            '(abcdef)',
          ],
        },
      },
      '(abcde)': {
        scalars: {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
      '(abcdef)': {
        scalars: {
          id: 'abcdef',
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested array with IDs and a null', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          nestedArray {
            id,
            stringField,
            numberField,
            nullField
          }
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedArray: [
          {
            id: 'abcde',
            stringField: 'This is a string too!',
            numberField: 6,
            nullField: null,
          },
          null,
        ],
      },
      getDataID: ({ id }: { id: string }) => id,
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: ['(abcde)', null],
        },
      },
      '(abcde)': {
        scalars: {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested array without IDs', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          nestedArray {
            stringField,
            numberField,
            nullField
          }
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedArray: [
          {
            stringField: 'This is a string too!',
            numberField: 6,
            nullField: null,
          },
          {
            stringField: 'This is a string also!',
            numberField: 7,
            nullField: null,
          },
        ],
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: [
            'root.nestedArray[0]',
            'root.nestedArray[1]',
          ],
        },
      },
      'root.nestedArray[0]': {
        scalars: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
      'root.nestedArray[1]': {
        scalars: {
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested array without IDs and a null item', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          nestedArray {
            stringField,
            numberField,
            nullField
          }
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedArray: [
          null,
          {
            stringField: 'This is a string also!',
            numberField: 7,
            nullField: null,
          },
        ],
      },
    });

    assert.deepEqual(graph.data, {
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
            'root.nestedArray[1]',
          ],
        },
      },
      'root.nestedArray[1]': {
        scalars: {
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes an array of non-objects', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          simpleArray
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        simpleArray: ['one', 'two', 'three'],
      },
    });

    assert.deepEqual(graph.data, {
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
  });

  it('properly normalizes an array of non-objects with null', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          simpleArray
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        simpleArray: [null, 'two', 'three'],
      },
    });

    assert.deepEqual(graph.data, {
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
  });

  it('merges nodes', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          numberField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        numberField: 5,
        nullField: null,
      },
    });

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          numberField: 5,
          stringField: 'This is a string!',
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested object that returns null', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          nestedObj {
            id,
            stringField,
            numberField,
            nullField
          }
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedObj: null,
      },
    });

    assert.deepEqual(graph.data, {
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
  });

  it('properly normalizes an object with an ID when no extension is passed', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          people_one(id: "5") {
            id
            stringField
          }
        }
      `),
      data: {
        people_one: {
          id: 'abcd',
          stringField: 'This is a string!',
        },
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          'people_one({"id":"5"})': 'root.people_one({"id":"5"})',
        },
      },
      'root.people_one({"id":"5"})': {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
        },
        references: {},
      },
    });
  });

  it('consistently serialize different types of input when passed inlined or as variable', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        mut1: mut(inline: 5, variable: $in1) { id }
        mut2: mut(inline: 5.5, variable: $in2) { id }
        mut3: mut(inline: "abc", variable: $in3) { id }
        mut4: mut(inline: [1, 2], variable: $in4) { id }
        mut5: mut(inline: { a: 1 }, variable: $in5) { id }
        mut6: mut(inline: true, variable: $in6) { id }
      }`),
      variables: {
        in1: 5,
        in2: 5.5,
        in3: 'abc',
        in4: [1, 2],
        in5: { a: 1 },
        in6: true,
      },
      data: {
        mut1: null,
        mut2: null,
        mut3: null,
        mut4: null,
        mut5: null,
        mut6: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          'mut({"inline":5,"variable":5})': null,
          'mut({"inline":5.5,"variable":5.5})': null,
          'mut({"inline":"abc","variable":"abc"})': null,
          'mut({"inline":[1,2],"variable":[1,2]})': null,
          'mut({"inline":{"a":1},"variable":{"a":1}})': null,
          'mut({"inline":true,"variable":true})': null,
        },
      },
    });
  });

  it('properly normalizes an operation with object or array parameters and variables', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          some_mutation(
            input: {
              id: "5",
              arr: [1,{a:"b"}],
              obj: {a:"b"},
              num: 5.5,
              nil: $nil,
              bo: true
            },
          ) {
            id,
          }
          some_mutation_with_variables(
            input: $in,
          ) {
            id,
          }
        }
      `),
      variables: {
        nil: null,
        in: {
          id: '5',
          arr: [1, { a: 'b' }],
          obj: { a: 'b' },
          num: 5.5,
          nil: null,
          bo: true,
        },
      },
      data: {
        some_mutation: {
          id: 'id',
        },
        some_mutation_with_variables: {
          id: 'id',
        },
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          'some_mutation({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})':
            'root.some_mutation({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})',
          'some_mutation_with_variables({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})':
            'root.some_mutation_with_variables({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})',
        },
      },
      'root.some_mutation({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})': {
        scalars: { id: 'id' },
        references: {},
      },
      'root.some_mutation_with_variables({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})': {
        scalars: { id: 'id' },
        references: {},
      },
    });
  });

  describe('type escaping', () => {
    const getDataID = (object: any) => {
      if (object.__typename && object.id) {
        return object.__typename + '__' + object.id;
      }
      return undefined;
    };

    it('should correctly escape generated ids', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          author {
            firstName
            lastName
          }
        }`),
        data: {
          author: {
            firstName: 'John',
            lastName: 'Smith',
          },
        },
      });

      assert.deepEqual(graph.data, {
        root: {
          scalars: {},
          references: {
            author: 'root.author',
          },
        },
        'root.author': {
          scalars: {
            firstName: 'John',
            lastName: 'Smith',
          },
          references: {},
        },
      });
    });

    it('should correctly escape real ids', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          author {
            firstName
            id
            __typename
          }
        }`),
        data: {
          author: {
            firstName: 'John',
            id: '129',
            __typename: 'Author',
          },
        },
        getDataID,
      });

      assert.deepEqual(graph.data, {
        root: {
          scalars: {},
          references: {
            author: '(Author__129)',
          },
        },
        '(Author__129)': {
          scalars: {
            firstName: 'John',
            id: '129',
            __typename: 'Author',
          },
          references: {},
        },
      });
    });

    it('should correctly escape json blobs', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          author {
            info
            id
            __typename
          }
        }`),
        data: {
          author: {
            info: {
              name: 'John',
            },
            id: '129',
            __typename: 'Author',
          },
        },
        getDataID,
      });

      assert.deepEqual(graph.data, {
        root: {
          scalars: {},
          references: {
            author: '(Author__129)',
          },
        },
        '(Author__129)': {
          scalars: {
            info: {
              name: 'John',
            },
            id: '129',
            __typename: 'Author',
          },
          references: {},
        },
      });
    });
  });

  it('does not swallow errors other than field errors', () => {
    assert.throws(() => {
      writeToGraph({
        graph: createMockGraphPrimitives(),
        id: 'root',
        selectionSet: parseSelectionSet(`{
          ...notARealFragment
          fortuneCookie
        }`),
        data: {
          fortuneCookie: 'Star Wars unit tests are boring',
        },
      });
    }, 'Could not find fragment named \'notARealFragment\'.');
  });
});
