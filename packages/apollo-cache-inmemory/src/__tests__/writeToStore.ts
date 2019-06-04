import { cloneDeep, assign, omit } from 'lodash';

import {
  SelectionNode,
  FieldNode,
  DefinitionNode,
  OperationDefinitionNode,
  ASTNode,
} from 'graphql';

import gql from 'graphql-tag';
import {
  storeKeyNameFromField,
  IdValue,
  addTypenameToDocument,
} from 'apollo-utilities';

import { StoreWriter } from '../writeToStore';

import { defaultNormalizedCacheFactory } from '../objectCache';

import {
  HeuristicFragmentMatcher,
  IntrospectionFragmentMatcher,
  StoreObject,
} from '../';

export function withWarning(func: Function, regex: RegExp) {
  let message: string = null as never;
  const oldWarn = console.warn;

  console.warn = (m: string) => (message = m);

  return Promise.resolve(func()).then(val => {
    expect(message).toMatch(regex);
    console.warn = oldWarn;
    return val;
  });
}

const getIdField = ({ id }: { id: string }) => id;

describe('writing to the store', () => {
  const writer = new StoreWriter();

  it('properly normalizes a trivial item', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
      }
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    expect(
      writer
        .writeQueryToStore({
          query,
          result: cloneDeep(result),
        })
        .toObject(),
    ).toEqual({
      ROOT_QUERY: result,
    });
  });

  it('properly normalizes an aliased field', () => {
    const query = gql`
      {
        id
        aliasedField: stringField
        numberField
        nullField
      }
    `;

    const result: any = {
      id: 'abcd',
      aliasedField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    const normalized = writer.writeQueryToStore({
      result,
      query,
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
      },
    });
  });

  it('properly normalizes a aliased fields with arguments', () => {
    const query = gql`
      {
        id
        aliasedField1: stringField(arg: 1)
        aliasedField2: stringField(arg: 2)
        numberField
        nullField
      }
    `;

    const result: any = {
      id: 'abcd',
      aliasedField1: 'The arg was 1!',
      aliasedField2: 'The arg was 2!',
      numberField: 5,
      nullField: null,
    };

    const normalized = writer.writeQueryToStore({
      result,
      query,
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: {
        id: 'abcd',
        'stringField({"arg":1})': 'The arg was 1!',
        'stringField({"arg":2})': 'The arg was 2!',
        numberField: 5,
        nullField: null,
      },
    });
  });

  it('properly normalizes a query with variables', () => {
    const query = gql`
      {
        id
        stringField(arg: $stringArg)
        numberField(intArg: $intArg, floatArg: $floatArg)
        nullField
      }
    `;

    const variables = {
      intArg: 5,
      floatArg: 3.14,
      stringArg: 'This is a string!',
    };

    const result: any = {
      id: 'abcd',
      stringField: 'Heyo',
      numberField: 5,
      nullField: null,
    };

    const normalized = writer.writeQueryToStore({
      result,
      query,
      variables,
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: {
        id: 'abcd',
        nullField: null,
        'numberField({"floatArg":3.14,"intArg":5})': 5,
        'stringField({"arg":"This is a string!"})': 'Heyo',
      },
    });
  });

  it('properly normalizes a query with default values', () => {
    const query = gql`
      query someBigQuery(
        $stringArg: String = "This is a default string!"
        $intArg: Int
        $floatArg: Float
      ) {
        id
        stringField(arg: $stringArg)
        numberField(intArg: $intArg, floatArg: $floatArg)
        nullField
      }
    `;

    const variables = {
      intArg: 5,
      floatArg: 3.14,
    };

    const result: any = {
      id: 'abcd',
      stringField: 'Heyo',
      numberField: 5,
      nullField: null,
    };

    const normalized = writer.writeQueryToStore({
      result,
      query,
      variables,
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: {
        id: 'abcd',
        nullField: null,
        'numberField({"floatArg":3.14,"intArg":5})': 5,
        'stringField({"arg":"This is a default string!"})': 'Heyo',
      },
    });
  });

  it('properly normalizes a query with custom directives', () => {
    const query = gql`
      query {
        id
        firstName @include(if: true)
        lastName @upperCase
        birthDate @dateFormat(format: "DD-MM-YYYY")
      }
    `;

    const result: any = {
      id: 'abcd',
      firstName: 'James',
      lastName: 'BOND',
      birthDate: '20-05-1940',
    };

    const normalized = writer.writeQueryToStore({
      result,
      query,
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: {
        id: 'abcd',
        firstName: 'James',
        'lastName@upperCase': 'BOND',
        'birthDate@dateFormat({"format":"DD-MM-YYYY"})': '20-05-1940',
      },
    });
  });

  it('properly normalizes a nested object with an ID', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        nestedObj {
          id
          stringField
          numberField
          nullField
        }
      }
    `;

    const result: any = {
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
    };

    expect(
      writer
        .writeQueryToStore({
          query,
          result: cloneDeep(result),
          dataIdFromObject: getIdField,
        })
        .toObject(),
    ).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedObj')), {
        nestedObj: {
          type: 'id',
          id: result.nestedObj.id,
          generated: false,
        },
      }),
      [result.nestedObj.id]: result.nestedObj,
    });
  });

  it('properly normalizes a nested object without an ID', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        nestedObj {
          stringField
          numberField
          nullField
        }
      }
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: {
        stringField: 'This is a string too!',
        numberField: 6,
        nullField: null,
      },
    };

    expect(
      writer
        .writeQueryToStore({
          query,
          result: cloneDeep(result),
        })
        .toObject(),
    ).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedObj')), {
        nestedObj: {
          type: 'id',
          id: `$ROOT_QUERY.nestedObj`,
          generated: true,
        },
      }),
      [`$ROOT_QUERY.nestedObj`]: result.nestedObj,
    });
  });

  it('properly normalizes a nested object with arguments but without an ID', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        nestedObj(arg: "val") {
          stringField
          numberField
          nullField
        }
      }
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: {
        stringField: 'This is a string too!',
        numberField: 6,
        nullField: null,
      },
    };

    expect(
      writer
        .writeQueryToStore({
          query,
          result: cloneDeep(result),
        })
        .toObject(),
    ).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedObj')), {
        'nestedObj({"arg":"val"})': {
          type: 'id',
          id: `$ROOT_QUERY.nestedObj({"arg":"val"})`,
          generated: true,
        },
      }),
      [`$ROOT_QUERY.nestedObj({"arg":"val"})`]: result.nestedObj,
    });
  });

  it('properly normalizes a nested array with IDs', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        nestedArray {
          id
          stringField
          numberField
          nullField
        }
      }
    `;

    const result: any = {
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
    };

    expect(
      writer
        .writeQueryToStore({
          query,
          result: cloneDeep(result),
          dataIdFromObject: getIdField,
        })
        .toObject(),
    ).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: result.nestedArray.map((obj: any) => ({
          type: 'id',
          id: obj.id,
          generated: false,
        })),
      }),
      [result.nestedArray[0].id]: result.nestedArray[0],
      [result.nestedArray[1].id]: result.nestedArray[1],
    });
  });

  it('properly normalizes a nested array with IDs and a null', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        nestedArray {
          id
          stringField
          numberField
          nullField
        }
      }
    `;

    const result: any = {
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
    };

    expect(
      writer
        .writeQueryToStore({
          query,
          result: cloneDeep(result),
          dataIdFromObject: getIdField,
        })
        .toObject(),
    ).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: [
          { type: 'id', id: result.nestedArray[0].id, generated: false },
          null,
        ],
      }),
      [result.nestedArray[0].id]: result.nestedArray[0],
    });
  });

  it('properly normalizes a nested array without IDs', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        nestedArray {
          stringField
          numberField
          nullField
        }
      }
    `;

    const result: any = {
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
    };

    const normalized = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: [
          { type: 'id', generated: true, id: `ROOT_QUERY.nestedArray.0` },
          { type: 'id', generated: true, id: `ROOT_QUERY.nestedArray.1` },
        ],
      }),
      [`ROOT_QUERY.nestedArray.0`]: result.nestedArray[0],
      [`ROOT_QUERY.nestedArray.1`]: result.nestedArray[1],
    });
  });

  it('properly normalizes a nested array without IDs and a null item', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        nestedArray {
          stringField
          numberField
          nullField
        }
      }
    `;

    const result: any = {
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
    };

    const normalized = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: [
          null,
          { type: 'id', generated: true, id: `ROOT_QUERY.nestedArray.1` },
        ],
      }),
      [`ROOT_QUERY.nestedArray.1`]: result.nestedArray[1],
    });
  });

  it('properly normalizes an array of non-objects', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        simpleArray
      }
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      simpleArray: ['one', 'two', 'three'],
    };

    const normalized = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'simpleArray')), {
        simpleArray: {
          type: 'json',
          json: [
            result.simpleArray[0],
            result.simpleArray[1],
            result.simpleArray[2],
          ],
        },
      }),
    });
  });

  it('properly normalizes an array of non-objects with null', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        simpleArray
      }
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      simpleArray: [null, 'two', 'three'],
    };

    const normalized = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'simpleArray')), {
        simpleArray: {
          type: 'json',
          json: [
            result.simpleArray[0],
            result.simpleArray[1],
            result.simpleArray[2],
          ],
        },
      }),
    });
  });

  it('properly normalizes an object occurring in different graphql paths twice', () => {
    const query = gql`
      {
        id
        object1 {
          id
          stringField
        }
        object2 {
          id
          numberField
        }
      }
    `;

    const result: any = {
      id: 'a',
      object1: {
        id: 'aa',
        stringField: 'string',
      },
      object2: {
        id: 'aa',
        numberField: 1,
      },
    };

    const normalized = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: {
        id: 'a',
        object1: {
          type: 'id',
          id: 'aa',
          generated: false,
        },
        object2: {
          type: 'id',
          id: 'aa',
          generated: false,
        },
      },
      aa: {
        id: 'aa',
        stringField: 'string',
        numberField: 1,
      },
    });
  });

  it('properly normalizes an object occurring in different graphql array paths twice', () => {
    const query = gql`
      {
        id
        array1 {
          id
          stringField
          obj {
            id
            stringField
          }
        }
        array2 {
          id
          stringField
          obj {
            id
            numberField
          }
        }
      }
    `;

    const result: any = {
      id: 'a',
      array1: [
        {
          id: 'aa',
          stringField: 'string',
          obj: {
            id: 'aaa',
            stringField: 'string',
          },
        },
      ],
      array2: [
        {
          id: 'ab',
          stringField: 'string2',
          obj: {
            id: 'aaa',
            numberField: 1,
          },
        },
      ],
    };

    const normalized = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: {
        id: 'a',
        array1: [
          {
            type: 'id',
            id: 'aa',
            generated: false,
          },
        ],
        array2: [
          {
            type: 'id',
            id: 'ab',
            generated: false,
          },
        ],
      },
      aa: {
        id: 'aa',
        stringField: 'string',
        obj: {
          type: 'id',
          id: 'aaa',
          generated: false,
        },
      },
      ab: {
        id: 'ab',
        stringField: 'string2',
        obj: {
          type: 'id',
          id: 'aaa',
          generated: false,
        },
      },
      aaa: {
        id: 'aaa',
        stringField: 'string',
        numberField: 1,
      },
    });
  });

  it('properly normalizes an object occurring in the same graphql array path twice', () => {
    const query = gql`
      {
        id
        array1 {
          id
          stringField
          obj {
            id
            stringField
            numberField
          }
        }
      }
    `;

    const result: any = {
      id: 'a',
      array1: [
        {
          id: 'aa',
          stringField: 'string',
          obj: {
            id: 'aaa',
            stringField: 'string',
            numberField: 1,
          },
        },
        {
          id: 'ab',
          stringField: 'string2',
          obj: {
            id: 'aaa',
            stringField: 'should not be written',
            numberField: 2,
          },
        },
      ],
    };

    const normalized = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    });

    expect(normalized.toObject()).toEqual({
      ROOT_QUERY: {
        id: 'a',
        array1: [
          {
            type: 'id',
            id: 'aa',
            generated: false,
          },
          {
            type: 'id',
            id: 'ab',
            generated: false,
          },
        ],
      },
      aa: {
        id: 'aa',
        stringField: 'string',
        obj: {
          type: 'id',
          id: 'aaa',
          generated: false,
        },
      },
      ab: {
        id: 'ab',
        stringField: 'string2',
        obj: {
          type: 'id',
          id: 'aaa',
          generated: false,
        },
      },
      aaa: {
        id: 'aaa',
        stringField: 'string',
        numberField: 1,
      },
    });
  });

  it('merges nodes', () => {
    const query = gql`
      {
        id
        numberField
        nullField
      }
    `;

    const result: any = {
      id: 'abcd',
      numberField: 5,
      nullField: null,
    };

    const store = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    });

    const query2 = gql`
      {
        id
        stringField
        nullField
      }
    `;

    const result2: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      nullField: null,
    };

    const store2 = writer.writeQueryToStore({
      store,
      query: query2,
      result: result2,
      dataIdFromObject: getIdField,
    });

    expect(store2.toObject()).toEqual({
      ROOT_QUERY: assign({}, result, result2),
    });
  });

  it('properly normalizes a nested object that returns null', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
        nestedObj {
          id
          stringField
          numberField
          nullField
        }
      }
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: null,
    };

    expect(
      writer
        .writeQueryToStore({
          query,
          result: cloneDeep(result),
        })
        .toObject(),
    ).toEqual({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedObj')), {
        nestedObj: null,
      }),
    });
  });

  it('properly normalizes an object with an ID when no extension is passed', () => {
    const query = gql`
      {
        people_one(id: "5") {
          id
          stringField
        }
      }
    `;

    const result: any = {
      people_one: {
        id: 'abcd',
        stringField: 'This is a string!',
      },
    };

    expect(
      writer
        .writeQueryToStore({
          query,
          result: cloneDeep(result),
        })
        .toObject(),
    ).toEqual({
      ROOT_QUERY: {
        'people_one({"id":"5"})': {
          type: 'id',
          id: '$ROOT_QUERY.people_one({"id":"5"})',
          generated: true,
        },
      },
      '$ROOT_QUERY.people_one({"id":"5"})': {
        id: 'abcd',
        stringField: 'This is a string!',
      },
    });
  });

  it('consistently serialize different types of input when passed inlined or as variable', () => {
    const testData = [
      {
        mutation: gql`
          mutation mut($in: Int!) {
            mut(inline: 5, variable: $in) {
              id
            }
          }
        `,
        variables: { in: 5 },
        expected: 'mut({"inline":5,"variable":5})',
      },
      {
        mutation: gql`
          mutation mut($in: Float!) {
            mut(inline: 5.5, variable: $in) {
              id
            }
          }
        `,
        variables: { in: 5.5 },
        expected: 'mut({"inline":5.5,"variable":5.5})',
      },
      {
        mutation: gql`
          mutation mut($in: String!) {
            mut(inline: "abc", variable: $in) {
              id
            }
          }
        `,
        variables: { in: 'abc' },
        expected: 'mut({"inline":"abc","variable":"abc"})',
      },
      {
        mutation: gql`
          mutation mut($in: Array!) {
            mut(inline: [1, 2], variable: $in) {
              id
            }
          }
        `,
        variables: { in: [1, 2] },
        expected: 'mut({"inline":[1,2],"variable":[1,2]})',
      },
      {
        mutation: gql`
          mutation mut($in: Object!) {
            mut(inline: { a: 1 }, variable: $in) {
              id
            }
          }
        `,
        variables: { in: { a: 1 } },
        expected: 'mut({"inline":{"a":1},"variable":{"a":1}})',
      },
      {
        mutation: gql`
          mutation mut($in: Boolean!) {
            mut(inline: true, variable: $in) {
              id
            }
          }
        `,
        variables: { in: true },
        expected: 'mut({"inline":true,"variable":true})',
      },
    ];

    function isOperationDefinition(
      definition: DefinitionNode,
    ): definition is OperationDefinitionNode {
      return definition.kind === 'OperationDefinition';
    }

    function isField(selection: SelectionNode): selection is FieldNode {
      return selection.kind === 'Field';
    }

    testData.forEach(data => {
      data.mutation.definitions.forEach(
        (definition: OperationDefinitionNode) => {
          if (isOperationDefinition(definition)) {
            definition.selectionSet.selections.forEach(selection => {
              if (isField(selection)) {
                expect(
                  storeKeyNameFromField(selection, data.variables),
                ).toEqual(data.expected);
              }
            });
          }
        },
      );
    });
  });

  it('properly normalizes a mutation with object or array parameters and variables', () => {
    const mutation = gql`
      mutation some_mutation($nil: ID, $in: Object) {
        some_mutation(
          input: {
            id: "5"
            arr: [1, { a: "b" }]
            obj: { a: "b" }
            num: 5.5
            nil: $nil
            bo: true
          }
        ) {
          id
        }
        some_mutation_with_variables(input: $in) {
          id
        }
      }
    `;

    const result: any = {
      some_mutation: {
        id: 'id',
      },
      some_mutation_with_variables: {
        id: 'id',
      },
    };

    const variables: any = {
      nil: null,
      in: {
        id: '5',
        arr: [1, { a: 'b' }],
        obj: { a: 'b' },
        num: 5.5,
        nil: null,
        bo: true,
      },
    };

    function isOperationDefinition(
      value: ASTNode,
    ): value is OperationDefinitionNode {
      return value.kind === 'OperationDefinition';
    }

    mutation.definitions.map((def: OperationDefinitionNode) => {
      if (isOperationDefinition(def)) {
        expect(
          writer
            .writeSelectionSetToStore({
              dataId: '5',
              selectionSet: def.selectionSet,
              result: cloneDeep(result),
              context: {
                store: defaultNormalizedCacheFactory(),
                variables,
                dataIdFromObject: () => '5',
              },
            })
            .toObject(),
        ).toEqual({
          '5': {
            id: 'id',
            'some_mutation({"input":{"arr":[1,{"a":"b"}],"bo":true,"id":"5","nil":null,"num":5.5,"obj":{"a":"b"}}})': {
              generated: false,
              id: '5',
              type: 'id',
            },
            'some_mutation_with_variables({"input":{"arr":[1,{"a":"b"}],"bo":true,"id":"5","nil":null,"num":5.5,"obj":{"a":"b"}}})': {
              generated: false,
              id: '5',
              type: 'id',
            },
          },
        });
      } else {
        throw 'No operation definition found';
      }
    });
  });

  it('should write to store if `dataIdFromObject` returns an ID of 0', () => {
    const query = gql`
      query {
        author {
          firstName
          id
          __typename
        }
      }
    `;
    const data = {
      author: {
        id: 0,
        __typename: 'Author',
        firstName: 'John',
      },
    };
    const expStore = defaultNormalizedCacheFactory({
      ROOT_QUERY: {
        author: {
          id: 0 as any,
          typename: 'Author',
          type: 'id',
          generated: false,
        },
      },
      0: {
        id: data.author.id,
        __typename: data.author.__typename,
        firstName: data.author.firstName,
      },
    });

    expect(
      writer
        .writeQueryToStore({
          result: data,
          query,
          dataIdFromObject: () => (0 as any) as string,
        })
        .toObject(),
    ).toEqual(expStore.toObject());
  });

  describe('type escaping', () => {
    const dataIdFromObject = (object: any) => {
      if (object.__typename && object.id) {
        return object.__typename + '__' + object.id;
      }
      return undefined;
    };

    it('should correctly escape generated ids', () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const expStore = defaultNormalizedCacheFactory({
        ROOT_QUERY: {
          author: {
            type: 'id' as any,
            id: '$ROOT_QUERY.author',
            generated: true,
          },
        },
        '$ROOT_QUERY.author': data.author,
      });
      expect(
        writer
          .writeQueryToStore({
            result: data,
            query,
          })
          .toObject(),
      ).toEqual(expStore.toObject());
    });

    it('should correctly escape real ids', () => {
      const query = gql`
        query {
          author {
            firstName
            id
            __typename
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          id: '129',
          __typename: 'Author',
        },
      };
      const expStore = defaultNormalizedCacheFactory({
        ROOT_QUERY: {
          author: {
            type: 'id',
            id: dataIdFromObject(data.author),
            generated: false,
            typename: 'Author',
          },
        },
        [dataIdFromObject(data.author)!]: {
          firstName: data.author.firstName,
          id: data.author.id,
          __typename: data.author.__typename,
        },
      });
      expect(
        writer
          .writeQueryToStore({
            result: data,
            query,
            dataIdFromObject,
          })
          .toObject(),
      ).toEqual(expStore.toObject());
    });

    it('should correctly escape json blobs', () => {
      const query = gql`
        query {
          author {
            info
            id
            __typename
          }
        }
      `;
      const data = {
        author: {
          info: {
            name: 'John',
          },
          id: '129',
          __typename: 'Author',
        },
      };
      const expStore = defaultNormalizedCacheFactory({
        ROOT_QUERY: {
          author: {
            type: 'id',
            id: dataIdFromObject(data.author),
            generated: false,
            typename: 'Author',
          },
        },
        [dataIdFromObject(data.author)!]: {
          __typename: data.author.__typename,
          id: data.author.id,
          info: {
            type: 'json',
            json: data.author.info,
          },
        },
      });
      expect(
        writer
          .writeQueryToStore({
            result: data,
            query,
            dataIdFromObject,
          })
          .toObject(),
      ).toEqual(expStore.toObject());
    });
  });

  it('should merge objects when overwriting a generated id with a real id', () => {
    const dataWithoutId = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
        __typename: 'Author',
      },
    };

    const dataWithId = {
      author: {
        firstName: 'John',
        id: '129',
        __typename: 'Author',
      },
    };
    const dataIdFromObject = (object: any) => {
      if (object.__typename && object.id) {
        return object.__typename + '__' + object.id;
      }
      return undefined;
    };
    const queryWithoutId = gql`
      query {
        author {
          firstName
          lastName
          __typename
        }
      }
    `;
    const queryWithId = gql`
      query {
        author {
          firstName
          id
          __typename
        }
      }
    `;
    const expStoreWithoutId = defaultNormalizedCacheFactory({
      '$ROOT_QUERY.author': {
        firstName: 'John',
        lastName: 'Smith',
        __typename: 'Author',
      },
      ROOT_QUERY: {
        author: {
          type: 'id',
          id: '$ROOT_QUERY.author',
          generated: true,
          typename: 'Author',
        },
      },
    });
    const expStoreWithId = defaultNormalizedCacheFactory({
      Author__129: {
        firstName: 'John',
        lastName: 'Smith',
        id: '129',
        __typename: 'Author',
      },
      ROOT_QUERY: {
        author: {
          type: 'id',
          id: 'Author__129',
          generated: false,
          typename: 'Author',
        },
      },
    });
    const storeWithoutId = writer.writeQueryToStore({
      result: dataWithoutId,
      query: queryWithoutId,
      dataIdFromObject,
    });
    expect(storeWithoutId.toObject()).toEqual(expStoreWithoutId.toObject());
    const storeWithId = writer.writeQueryToStore({
      result: dataWithId,
      query: queryWithId,
      store: storeWithoutId,
      dataIdFromObject,
    });
    expect(storeWithId.toObject()).toEqual(expStoreWithId.toObject());
  });

  it('should allow a union of objects of a different type, when overwriting a generated id with a real id', () => {
    const dataWithPlaceholder = {
      author: {
        hello: 'Foo',
        __typename: 'Placeholder',
      },
    };
    const dataWithAuthor = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
        id: '129',
        __typename: 'Author',
      },
    };
    const dataIdFromObject = (object: any) => {
      if (object.__typename && object.id) {
        return object.__typename + '__' + object.id;
      }
      return undefined;
    };
    const query = gql`
      query {
        author {
          ... on Author {
            firstName
            lastName
            id
            __typename
          }
          ... on Placeholder {
            hello
            __typename
          }
        }
      }
    `;
    const expStoreWithPlaceholder = defaultNormalizedCacheFactory({
      '$ROOT_QUERY.author': {
        hello: 'Foo',
        __typename: 'Placeholder',
      },
      ROOT_QUERY: {
        author: {
          type: 'id',
          id: '$ROOT_QUERY.author',
          generated: true,
          typename: 'Placeholder',
        },
      },
    });
    const expStoreWithAuthor = defaultNormalizedCacheFactory({
      Author__129: {
        firstName: 'John',
        lastName: 'Smith',
        id: '129',
        __typename: 'Author',
      },
      ROOT_QUERY: {
        author: {
          type: 'id',
          id: 'Author__129',
          generated: false,
          typename: 'Author',
        },
      },
    });

    // write the first object, without an ID, placeholder
    const store = writer.writeQueryToStore({
      result: dataWithPlaceholder,
      query,
      dataIdFromObject,
    });
    expect(store.toObject()).toEqual(expStoreWithPlaceholder.toObject());

    // replace with another one of different type with ID
    writer.writeQueryToStore({
      result: dataWithAuthor,
      query,
      store,
      dataIdFromObject,
    });
    expect(store.toObject()).toEqual(expStoreWithAuthor.toObject());

    // and go back to the original:
    writer.writeQueryToStore({
      result: dataWithPlaceholder,
      query,
      store,
      dataIdFromObject,
    });
    // Author__129 will remain in the store,
    // but will not be referenced by any of the fields,
    // hence we combine, and in that very order
    expect(store.toObject()).toEqual({
      ...expStoreWithAuthor.toObject(),
      ...expStoreWithPlaceholder.toObject(),
    });
  });

  it('does not swallow errors other than field errors', () => {
    const query = gql`
      query {
        ...notARealFragment
        fortuneCookie
      }
    `;
    const result: any = {
      fortuneCookie: 'Star Wars unit tests are boring',
    };
    expect(() => {
      writer.writeQueryToStore({
        result,
        query,
      });
    }).toThrowError(/No fragment/);
  });

  it('does not change object references if the value is the same', () => {
    const query = gql`
      {
        id
        stringField
        numberField
        nullField
      }
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };
    const store = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
    });

    const newStore = writer.writeQueryToStore({
      query,
      result: cloneDeep(result),
      store: defaultNormalizedCacheFactory(store.toObject()),
    });

    Object.keys(store.toObject()).forEach(field => {
      expect(store.get(field)).toEqual(newStore.get(field));
    });
  });

  describe('writeResultToStore shape checking', () => {
    const query = gql`
      query {
        todos {
          id
          name
          description
        }
      }
    `;

    it('should write the result data without validating its shape when a fragment matcher is not provided', () => {
      const result = {
        todos: [
          {
            id: '1',
            name: 'Todo 1',
          },
        ],
      };

      const newStore = writer.writeResultToStore({
        dataId: 'ROOT_QUERY',
        result,
        document: query,
        dataIdFromObject: getIdField,
      });

      expect(newStore.get('1')).toEqual(result.todos[0]);
    });

    it('should warn when it receives the wrong data with non-union fragments (using an heuristic matcher)', () => {
      const fragmentMatcherFunction = new HeuristicFragmentMatcher().match;

      const result = {
        todos: [
          {
            id: '1',
            name: 'Todo 1',
          },
        ],
      };

      return withWarning(() => {
        const newStore = writer.writeResultToStore({
          dataId: 'ROOT_QUERY',
          result,
          document: query,
          dataIdFromObject: getIdField,
          fragmentMatcherFunction,
        });

        expect(newStore.get('1')).toEqual(result.todos[0]);
      }, /Missing field description/);
    });

    it('should warn when it receives the wrong data inside a fragment (using an introspection matcher)', () => {
      const fragmentMatcherFunction = new IntrospectionFragmentMatcher({
        introspectionQueryResultData: {
          __schema: {
            types: [
              {
                kind: 'UNION',
                name: 'Todo',
                possibleTypes: [
                  { name: 'ShoppingCartItem' },
                  { name: 'TaskItem' },
                ],
              },
            ],
          },
        },
      }).match;

      const queryWithInterface = gql`
        query {
          todos {
            id
            name
            description
            ...TodoFragment
          }
        }

        fragment TodoFragment on Todo {
          ... on ShoppingCartItem {
            price
            __typename
          }
          ... on TaskItem {
            date
            __typename
          }
          __typename
        }
      `;

      const result = {
        todos: [
          {
            id: '1',
            name: 'Todo 1',
            description: 'Description 1',
            __typename: 'ShoppingCartItem',
          },
        ],
      };

      return withWarning(() => {
        const newStore = writer.writeResultToStore({
          dataId: 'ROOT_QUERY',
          result,
          document: queryWithInterface,
          dataIdFromObject: getIdField,
          fragmentMatcherFunction,
        });

        expect(newStore.get('1')).toEqual(result.todos[0]);
      }, /Missing field price/);
    });

    it('should warn if a result is missing __typename when required (using an heuristic matcher)', () => {
      const fragmentMatcherFunction = new HeuristicFragmentMatcher().match;

      const result: any = {
        todos: [
          {
            id: '1',
            name: 'Todo 1',
            description: 'Description 1',
          },
        ],
      };

      return withWarning(() => {
        const newStore = writer.writeResultToStore({
          dataId: 'ROOT_QUERY',
          result,
          document: addTypenameToDocument(query),
          dataIdFromObject: getIdField,
          fragmentMatcherFunction,
        });

        expect(newStore.get('1')).toEqual(result.todos[0]);
      }, /Missing field __typename/);
    });

    it('should not warn if a field is null', () => {
      const result: any = {
        todos: null,
      };

      const newStore = writer.writeResultToStore({
        dataId: 'ROOT_QUERY',
        result,
        document: query,
        dataIdFromObject: getIdField,
      });

      expect(newStore.get('ROOT_QUERY')).toEqual({ todos: null });
    });
    it('should not warn if a field is defered', () => {
      let originalWarn = console.warn;
      console.warn = jest.fn((...args) => {});
      const defered = gql`
        query LazyLoad {
          id
          expensive @defer
        }
      `;
      const result: any = {
        id: 1,
      };

      const fragmentMatcherFunction = new HeuristicFragmentMatcher().match;
      const newStore = writer.writeResultToStore({
        dataId: 'ROOT_QUERY',
        result,
        document: defered,
        dataIdFromObject: getIdField,
        fragmentMatcherFunction,
      });

      expect(newStore.get('ROOT_QUERY')).toEqual({ id: 1 });
      expect(console.warn).not.toBeCalled();
      console.warn = originalWarn;
    });
  });

  it('throws when trying to write an object without id that was previously queried with id', () => {
    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign(
        {},
        {
          __typename: 'Query',
          item: {
            type: 'id',
            id: 'abcd',
            generated: false,
          } as IdValue,
        },
      ) as StoreObject,
      abcd: assign(
        {},
        {
          id: 'abcd',
          __typename: 'Item',
          stringField: 'This is a string!',
        },
      ) as StoreObject,
    });

    expect(() => {
      writer.writeQueryToStore({
        store,
        result: {
          item: {
            __typename: 'Item',
            stringField: 'This is still a string!',
          },
        },
        query: gql`
          query Failure {
            item {
              stringField
            }
          }
        `,
        dataIdFromObject: getIdField,
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      writer.writeResultToStore({
        store,
        result: {
          item: {
            __typename: 'Item',
            stringField: 'This is still a string!',
          },
        },
        dataId: 'ROOT_QUERY',
        document: gql`
          query {
            item {
              stringField
            }
          }
        `,
        dataIdFromObject: getIdField,
      });
    }).toThrowError(/stringField(.|\n)*abcd/g);
  });

  it('properly handles the connection directive', () => {
    const store = defaultNormalizedCacheFactory();

    writer.writeQueryToStore({
      query: gql`
        {
          books(skip: 0, limit: 2) @connection(key: "abc") {
            name
          }
        }
      `,
      result: {
        books: [
          {
            name: 'abcd',
          },
        ],
      },
      store,
    });

    writer.writeQueryToStore({
      query: gql`
        {
          books(skip: 2, limit: 4) @connection(key: "abc") {
            name
          }
        }
      `,
      result: {
        books: [
          {
            name: 'efgh',
          },
        ],
      },
      store,
    });

    expect(store.toObject()).toEqual({
      ROOT_QUERY: {
        abc: [
          {
            generated: true,
            id: 'ROOT_QUERY.abc.0',
            type: 'id',
          },
        ],
      },
      'ROOT_QUERY.abc.0': {
        name: 'efgh',
      },
    });
  });

  it('should keep reference when type of mixed inlined field changes', () => {
    const store = defaultNormalizedCacheFactory();

    const query = gql`
      query {
        animals {
          species {
            name
          }
        }
      }
    `;

    writer.writeQueryToStore({
      query,
      result: {
        animals: [
          {
            __typename: 'Animal',
            species: {
              __typename: 'Cat',
              name: 'cat',
            },
          },
        ],
      },
      store,
    });

    expect(store.toObject()).toEqual({
      '$ROOT_QUERY.animals.0.species': { name: 'cat' },
      ROOT_QUERY: {
        animals: [
          {
            generated: true,
            id: 'ROOT_QUERY.animals.0',
            type: 'id',
            typename: 'Animal',
          },
        ],
      },
      'ROOT_QUERY.animals.0': {
        species: {
          generated: true,
          id: '$ROOT_QUERY.animals.0.species',
          type: 'id',
          typename: 'Cat',
        },
      },
    });

    writer.writeQueryToStore({
      query,
      result: {
        animals: [
          {
            __typename: 'Animal',
            species: {
              __typename: 'Dog',
              name: 'dog',
            },
          },
        ],
      },
      store,
    });

    expect(store.toObject()).toEqual({
      '$ROOT_QUERY.animals.0.species': { name: 'dog' },
      ROOT_QUERY: {
        animals: [
          {
            generated: true,
            id: 'ROOT_QUERY.animals.0',
            type: 'id',
            typename: 'Animal',
          },
        ],
      },
      'ROOT_QUERY.animals.0': {
        species: {
          generated: true,
          id: '$ROOT_QUERY.animals.0.species',
          type: 'id',
          typename: 'Dog',
        },
      },
    });
  });

  it('should not keep reference when type of mixed inlined field changes to non-inlined field', () => {
    const store = defaultNormalizedCacheFactory();

    const dataIdFromObject = (object: any) => {
      if (object.__typename && object.id) {
        return object.__typename + '__' + object.id;
      }
      return undefined;
    };

    const query = gql`
      query {
        animals {
          species {
            id
            name
          }
        }
      }
    `;

    writer.writeQueryToStore({
      query,
      result: {
        animals: [
          {
            __typename: 'Animal',
            species: {
              __typename: 'Cat',
              name: 'cat',
            },
          },
        ],
      },
      dataIdFromObject,
      store,
    });

    expect(store.toObject()).toEqual({
      '$ROOT_QUERY.animals.0.species': { name: 'cat' },
      ROOT_QUERY: {
        animals: [
          {
            generated: true,
            id: 'ROOT_QUERY.animals.0',
            type: 'id',
            typename: 'Animal',
          },
        ],
      },
      'ROOT_QUERY.animals.0': {
        species: {
          generated: true,
          id: '$ROOT_QUERY.animals.0.species',
          type: 'id',
          typename: 'Cat',
        },
      },
    });

    writer.writeQueryToStore({
      query,
      result: {
        animals: [
          {
            __typename: 'Animal',
            species: {
              id: 'dog-species',
              __typename: 'Dog',
              name: 'dog',
            },
          },
        ],
      },
      dataIdFromObject,
      store,
    });

    expect(store.toObject()).toEqual({
      '$ROOT_QUERY.animals.0.species': undefined,
      'Dog__dog-species': {
        id: 'dog-species',
        name: 'dog',
      },
      ROOT_QUERY: {
        animals: [
          {
            generated: true,
            id: 'ROOT_QUERY.animals.0',
            type: 'id',
            typename: 'Animal',
          },
        ],
      },
      'ROOT_QUERY.animals.0': {
        species: {
          generated: false,
          id: 'Dog__dog-species',
          type: 'id',
          typename: 'Dog',
        },
      },
    });
  });
});
