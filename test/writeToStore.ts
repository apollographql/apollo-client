import { assert } from 'chai';
import { cloneDeep, assign, omit } from 'lodash';

import {
  SelectionNode,
  FieldNode,
  DefinitionNode,
  OperationDefinitionNode,
  ASTNode,
} from 'graphql';

import gql from 'graphql-tag';

import { withWarning } from './util/wrap';

import {
  writeQueryToStore,
  writeResultToStore,
  writeSelectionSetToStore,
} from '../src/data/writeToStore';

import {
  storeKeyNameFromField,
} from '../src/data/storeUtils';

import {
  NormalizedCache,
} from '../src/data/storeUtils';

import {
  HeuristicFragmentMatcher,
  IntrospectionFragmentMatcher,
} from '../src/data/fragmentMatcher';

import {
  getFragmentDefinitions,
  createFragmentMap,
} from '../src/queries/getFromAST';

const getIdField = ({id}: {id: string}) => id;

describe('writing to the store', () => {
  it('properly normalizes a trivial item', () => {
    const query = gql`
      {
        id,
        stringField,
        numberField,
        nullField
      }
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    assert.deepEqual(writeQueryToStore({
      query,
      result: cloneDeep(result),
    }), {
      'ROOT_QUERY': result,
    });
  });

  it('properly normalizes an aliased field', () => {
    const query = gql`
      {
        id,
        aliasedField: stringField,
        numberField,
        nullField
      }
    `;

    const result: any = {
      id: 'abcd',
      aliasedField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    const normalized = writeQueryToStore({
      result,
      query,
    });

    assert.deepEqual(normalized, {
      'ROOT_QUERY': {
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
        id,
        aliasedField1: stringField(arg: 1),
        aliasedField2: stringField(arg: 2),
        numberField,
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

    const normalized = writeQueryToStore({
      result,
      query,
    });

    assert.deepEqual(normalized, {
      'ROOT_QUERY': {
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
        id,
        stringField(arg: $stringArg),
        numberField(intArg: $intArg, floatArg: $floatArg),
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

    const normalized = writeQueryToStore({
      result,
      query,
      variables,
    });

    assert.deepEqual(normalized, {
      'ROOT_QUERY': {
        id: 'abcd',
        nullField: null,
        'numberField({"intArg":5,"floatArg":3.14})': 5,
        'stringField({"arg":"This is a string!"})': 'Heyo',
      },
    });
  });

  it('properly normalizes a query with default values', () => {
    const query = gql`
      query someBigQuery($stringArg: String = "This is a default string!", $intArg: Int, $floatArg: Float){
        id,
        stringField(arg: $stringArg),
        numberField(intArg: $intArg, floatArg: $floatArg),
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

    const normalized = writeQueryToStore({
      result,
      query,
      variables,
    });

    assert.deepEqual(normalized, {
      'ROOT_QUERY': {
        id: 'abcd',
        nullField: null,
        'numberField({"intArg":5,"floatArg":3.14})': 5,
        'stringField({"arg":"This is a default string!"})': 'Heyo',
      },
    });
  });

  it('properly normalizes a nested object with an ID', () => {
    const query = gql`
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

    assert.deepEqual(writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    }), {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedObj')), {
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

    assert.deepEqual(writeQueryToStore({
      query,
      result: cloneDeep(result),
    }), {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedObj')), {
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

    assert.deepEqual(writeQueryToStore({
      query,
      result: cloneDeep(result),
    }), {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedObj')), {
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

    assert.deepEqual(writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    }), {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedArray')), {
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

    assert.deepEqual(writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    }), {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedArray')), {
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

    const normalized = writeQueryToStore({
      query,
      result: cloneDeep(result),
    });

    assert.deepEqual(normalized, {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedArray')), {
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

    const normalized = writeQueryToStore({
      query,
      result: cloneDeep(result),
    });

    assert.deepEqual(normalized, {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedArray')), {
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
        id,
        stringField,
        numberField,
        nullField,
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

    const normalized = writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    });

    assert.deepEqual(normalized, {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'simpleArray')), {
        simpleArray: {
          type: 'json',
          'json': [
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
        id,
        stringField,
        numberField,
        nullField,
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

    const normalized = writeQueryToStore({
      query,
      result: cloneDeep(result),
    });

    assert.deepEqual(normalized, {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'simpleArray')), {
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

  it('merges nodes', () => {
    const query = gql`
      {
        id,
        numberField,
        nullField
      }
    `;

    const result: any = {
      id: 'abcd',
      numberField: 5,
      nullField: null,
    };

    const store = writeQueryToStore({
      query,
      result: cloneDeep(result),
      dataIdFromObject: getIdField,
    });

    const query2 = gql`
      {
        id,
        stringField,
        nullField
      }
    `;

    const result2: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      nullField: null,
    };

    const store2 = writeQueryToStore({
      store,
      query: query2,
      result: result2,
      dataIdFromObject: getIdField,
    });

    assert.deepEqual(store2, {
      'ROOT_QUERY': assign({}, result, result2),
    });
  });

  it('properly normalizes a nested object that returns null', () => {
    const query = gql`
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
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: null,
    };

    assert.deepEqual(writeQueryToStore({
      query,
      result: cloneDeep(result),
    }), {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedObj')), {
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

    assert.deepEqual(writeQueryToStore({
      query,
      result: cloneDeep(result),
    }), {
      'ROOT_QUERY': {
        'people_one({"id":"5"})': {
          type: 'id',
          id: '$ROOT_QUERY.people_one({"id":"5"})',
          generated: true,
        },
      },
      '$ROOT_QUERY.people_one({"id":"5"})': {
        'id': 'abcd',
        'stringField': 'This is a string!',
      },
    });
  });

  it('consistently serialize different types of input when passed inlined or as variable', () => {
    const testData = [
      {
        mutation: gql`mutation mut($in: Int!) { mut(inline: 5, variable: $in) { id } }`,
        variables: { in: 5 },
        expected: 'mut({"inline":5,"variable":5})',
      },
      {
        mutation: gql`mutation mut($in: Float!) { mut(inline: 5.5, variable: $in) { id } }`,
        variables: { in: 5.5 },
        expected: 'mut({"inline":5.5,"variable":5.5})',
      },
      {
        mutation: gql`mutation mut($in: String!) { mut(inline: "abc", variable: $in) { id } }`,
        variables: { in: 'abc' },
        expected: 'mut({"inline":"abc","variable":"abc"})',
      },
      {
        mutation: gql`mutation mut($in: Array!) { mut(inline: [1, 2], variable: $in) { id } }`,
        variables: { in: [1, 2] },
        expected: 'mut({"inline":[1,2],"variable":[1,2]})',
      },
      {
        mutation: gql`mutation mut($in: Object!) { mut(inline: {a: 1}, variable: $in) { id } }`,
        variables: { in: { a: 1 } },
        expected: 'mut({"inline":{"a":1},"variable":{"a":1}})',
      },
      {
        mutation: gql`mutation mut($in: Boolean!) { mut(inline: true, variable: $in) { id } }`,
        variables: { in: true },
        expected: 'mut({"inline":true,"variable":true})',
      },
    ];

    function isOperationDefinition(definition: DefinitionNode): definition is OperationDefinitionNode {
      return definition.kind === 'OperationDefinition';
    }

    function isField(selection: SelectionNode): selection is FieldNode {
      return selection.kind === 'Field';
    }

    testData.forEach((data) => {
      data.mutation.definitions.forEach((definition: OperationDefinitionNode) => {
        if (isOperationDefinition(definition)) {
          definition.selectionSet.selections.forEach((selection) => {
            if (isField(selection)) {
              assert.equal(storeKeyNameFromField(selection, data.variables), data.expected);
            }
          });
        }
      });
    });
  });

  it('properly normalizes a mutation with object or array parameters and variables', () => {
    const mutation = gql`
      mutation some_mutation(
          $nil: ID,
          $in: Object
        ) {
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

    function isOperationDefinition(value: ASTNode): value is OperationDefinitionNode {
      return value.kind === 'OperationDefinition';
    }

    mutation.definitions.map((def: OperationDefinitionNode) => {
      if (isOperationDefinition(def)) {
        assert.deepEqual(writeSelectionSetToStore({
          dataId: '5',
          selectionSet: def.selectionSet,
          result: cloneDeep(result),
          context: {
            store: {},
            variables,
            dataIdFromObject: () => '5',
          },
        }), {
          '5': {
            'some_mutation({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})': {
              type: 'id',
              id: '5',
              generated: false,
            },
            'some_mutation_with_variables({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})': {
              type: 'id',
              id: '5',
              generated: false,
            },
            'id': 'id',
          },
        });
      } else {
        throw 'No operation definition found';
      }
    });
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
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const expStore = {
        ROOT_QUERY: {
          author: {
            type: 'id',
            id: '$ROOT_QUERY.author',
            generated: true,
          },
        },
        '$ROOT_QUERY.author': data.author,
      };
      assert.deepEqual(writeQueryToStore({
        result: data,
        query,
      }), expStore);
    });

    it('should correctly escape real ids', () => {
      const query = gql`
        query {
          author {
            firstName
            id
            __typename
          }
        }`;
      const data = {
        author: {
          firstName: 'John',
          id: '129',
          __typename: 'Author',
        },
      };
      const expStore = {
        ROOT_QUERY: {
          author: {
            type: 'id',
            id: dataIdFromObject(data.author),
            generated: false,
          },
        },
        [dataIdFromObject(data.author)!]: {
          firstName: data.author.firstName,
          id: data.author.id,
          __typename: data.author.__typename,
        },
      };
      assert.deepEqual(writeQueryToStore({
        result: data,
        query,
        dataIdFromObject,
      }), expStore);
    });

    it('should correctly escape json blobs', () => {
      const query = gql`
        query {
          author {
            info
            id
            __typename
          }
        }`;
      const data = {
        author: {
          info: {
            name: 'John',
          },
          id: '129',
          __typename: 'Author',
        },
      };
      const expStore = {
        ROOT_QUERY: {
          author: {
            type: 'id',
            id: dataIdFromObject(data.author),
            generated: false,
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
      };
      assert.deepEqual(writeQueryToStore({
        result: data,
        query,
        dataIdFromObject,
      }), expStore);
    });
  });

  it('should merge objects when overwriting a generated id with a real id', () => {
    const dataWithoutId = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
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
        }
      }`;
    const queryWithId = gql`
      query {
        author {
          firstName
          id
          __typename
        }
      }`;
    const expStoreWithoutId = {
      '$ROOT_QUERY.author': {
        firstName: 'John',
        lastName: 'Smith',
      },
      ROOT_QUERY: {
        'author': {
          type: 'id',
          id: '$ROOT_QUERY.author',
          generated: true,
        },
      },
    };
    const expStoreWithId = {
      'Author__129': {
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
        },
      },
    };
    const storeWithoutId = writeQueryToStore({
      result: dataWithoutId,
      query: queryWithoutId,
      dataIdFromObject,
    });
    assert.deepEqual(storeWithoutId, expStoreWithoutId);
    const storeWithId = writeQueryToStore({
      result: dataWithId,
      query: queryWithId,
      store: storeWithoutId,
      dataIdFromObject,
    });
    assert.deepEqual(storeWithId, expStoreWithId);
  });

  it('does not swallow errors other than field errors', () => {
    const query = gql`
      query {
        ...notARealFragment
        fortuneCookie
      }`;
    const result: any = {
      fortuneCookie: 'Star Wars unit tests are boring',
    };
    assert.throws(() => {
      writeQueryToStore({
        result,
        query,
      });
    }, /No fragment/);
  });

  it('does not change object references if the value is the same', () => {
    const query = gql`
      {
        id,
        stringField,
        numberField,
        nullField
      }
    `;

    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };
    const store = writeQueryToStore({
      query,
      result: cloneDeep(result),
    });

    const newStore = writeQueryToStore({
      query,
      result: cloneDeep(result),
      store: assign({}, store) as NormalizedCache,
    });

    Object.keys(store).forEach((field) => {
      assert.equal(store[field], newStore[field], 'references are the same');
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

      const newStore = writeResultToStore({
        dataId: 'ROOT_QUERY',
        result,
        document: query,
        dataIdFromObject: getIdField,
      });

      assert.deepEqual(newStore['1'], result.todos[0]);
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
        const newStore = writeResultToStore({
          dataId: 'ROOT_QUERY',
          result,
          document: query,
          dataIdFromObject: getIdField,
          fragmentMatcherFunction,
        });

        assert.deepEqual(newStore['1'], result.todos[0]);
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
          ...on ShoppingCartItem {
            price
            __typename
          }
          ...on TaskItem {
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
        const newStore = writeResultToStore({
          dataId: 'ROOT_QUERY',
          result,
          document: queryWithInterface,
          dataIdFromObject: getIdField,
          fragmentMatcherFunction,
        });

        assert.deepEqual(newStore['1'], result.todos[0]);
      }, /Missing field price/);
    });

    it('should not warn if a field is null', () => {
      const result = {
        todos: null,
      };

      const newStore = writeResultToStore({
        dataId: 'ROOT_QUERY',
        result,
        document: query,
        dataIdFromObject: getIdField,
      });

      assert.deepEqual(newStore['ROOT_QUERY'], { todos: null });
    });
  });
});
