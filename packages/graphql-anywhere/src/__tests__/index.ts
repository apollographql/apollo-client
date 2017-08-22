import gql from 'graphql-tag';

import graphql, { Resolver, ExecInfo } from '..';

describe('graphql anywhere', () => {
  it('does basic things', () => {
    const resolver = (_, root) => root + 'fake';

    const query = gql`
      {
        a {
          b
          ...frag
        }
      }

      fragment frag on X {
        c
      }
    `;

    const result = graphql(resolver, query, '', null, null);

    expect(result).toEqual({
      a: {
        b: 'fakefake',
        c: 'fakefake',
      },
    });
  });

  it('works with enum args', () => {
    const resolver = (fieldName, root, args) => args.value;

    const query = gql`
      {
        a(value: ENUM_VALUE)
      }
    `;

    const result = graphql(resolver, query);

    expect(result).toEqual({
      a: 'ENUM_VALUE',
    });
  });

  it('traverses arrays returned from the resolver', () => {
    const resolver = () => [1, 2];

    const query = gql`
      {
        a {
          b
        }
      }
    `;

    const result = graphql(resolver, query);

    expect(result).toEqual({
      a: [
        {
          b: [1, 2],
        },
        {
          b: [1, 2],
        },
      ],
    });
  });

  it('can traverse an object', () => {
    const obj = {
      a: {
        b: 'fun',
        c: ['also fun', 'also fun 2'],
        d: 'not fun',
      },
    };

    const resolver = (fieldName, root) => root[fieldName];

    const query = gql`
      {
        a {
          b
          c
        }
      }
    `;

    const result = graphql(resolver, query, obj, null, null);

    expect(result).toEqual({
      a: {
        b: 'fun',
        c: ['also fun', 'also fun 2'],
      },
    });
  });

  it('can traverse nested arrays', () => {
    const obj = {
      a: [
        {
          b: [[{ c: 1 }, { c: 2 }], [{ c: 3 }, { c: 4 }]],
        },
      ],
    };

    const resolver = (fieldName, root) => root[fieldName];

    const query = gql`
      {
        a {
          b {
            c
          }
        }
      }
    `;

    const result = graphql(resolver, query, obj, null, null);

    expect(result).toEqual({
      a: [
        {
          b: [[{ c: 1 }, { c: 2 }], [{ c: 3 }, { c: 4 }]],
        },
      ],
    });
  });

  it('can use arguments, both inline and variables', () => {
    const resolver = (fieldName, _, args) => args;

    const query = gql`
      {
        inline(int: 5, float: 3.14, string: "string")
        variables(int: $int, float: $float, string: $string)
      }
    `;

    const variables = {
      int: 6,
      float: 6.28,
      string: 'varString',
    };

    const result = graphql(resolver, query, null, null, variables);

    expect(result).toEqual({
      inline: {
        int: 5,
        float: 3.14,
        string: 'string',
      },
      variables: {
        int: 6,
        float: 6.28,
        string: 'varString',
      },
    });
  });

  it('will tolerate missing variables', () => {
    const resolver = (fieldName, _, args) => args;

    const query = gql`
      {
        variables(int: $int, float: $float, string: $string, missing: $missing)
      }
    `;

    const variables = {
      int: 6,
      float: 6.28,
      string: 'varString',
    };

    const result = graphql(resolver, query, null, null, variables);

    expect(result).toEqual({
      variables: {
        int: 6,
        float: 6.28,
        string: 'varString',
        missing: undefined,
      },
    });
  });

  it('can use skip and include', () => {
    const resolver = fieldName => fieldName;

    const query = gql`
      {
        a {
          b @skip(if: true)
          c @include(if: true)
          d @skip(if: false)
          e @include(if: false)
        }
      }
    `;

    const result = graphql(resolver, query, null, null, null);

    expect(result).toEqual({
      a: {
        c: 'c',
        d: 'd',
      },
    });
  });

  it('can use inline and named fragments', () => {
    const resolver = fieldName => fieldName;

    const query = gql`
      {
        a {
          ... on Type {
            b
            c
          }
          ...deFrag
        }
      }

      fragment deFrag on Type {
        d
        e
      }
    `;

    const result = graphql(resolver, query, null, null, null);

    expect(result).toEqual({
      a: {
        b: 'b',
        c: 'c',
        d: 'd',
        e: 'e',
      },
    });
  });

  it('can resolve deeply nested fragments', () => {
    const resolver = (fieldName, root) => {
      return root[fieldName];
    };

    const query = gql`
      {
        stringField
        numberField
        nullField
        ... on Item {
          nestedObj {
            stringField
            nullField
            deepNestedObj {
              stringField
              nullField
            }
          }
        }
        ... on Item {
          nestedObj {
            numberField
            nullField
            deepNestedObj {
              numberField
              nullField
            }
          }
        }
        ... on Item {
          nullObject
        }
        nestedObj {
          inlinedObjectStringField
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
        deepNestedObj: {
          stringField: 'This is a deep string',
          numberField: 7,
          nullField: null,
        },
        inlinedObjectStringField: 'This is a string of an inlined object',
      },
      nullObject: null,
    };

    const queryResult = graphql(resolver, query, result);

    // The result of the query shouldn't contain __data_id fields
    expect(queryResult).toEqual({
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
        inlinedObjectStringField: 'This is a string of an inlined object',
      },
      nullObject: null,
    });
  });

  it('can resolve deeply nested fragments with arrays', () => {
    const resolver = (fieldName, root) => {
      return root[fieldName];
    };

    const query = gql`
      {
        ... on Item {
          array {
            id
            field1
          }
        }
        ... on Item {
          array {
            id
            field2
          }
        }
        ... on Item {
          array {
            id
            field3
          }
        }
      }
    `;

    const result: any = {
      array: [
        {
          id: 'abcde',
          field1: 1,
          field2: 2,
          field3: 3,
        },
      ],
    };

    const queryResult = graphql(resolver, query, result);

    expect(queryResult).toEqual({
      array: [
        {
          id: 'abcde',
          field1: 1,
          field2: 2,
          field3: 3,
        },
      ],
    });
  });

  it('readme example', () => {
    // I don't need all this stuff!
    const gitHubAPIResponse = {
      url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347',
      title: 'Found a bug',
      body: "I'm having a problem with this.",
      user: {
        login: 'octocat',
        avatar_url: 'https://github.com/images/error/octocat_happy.gif',
        url: 'https://api.github.com/users/octocat',
      },
      labels: [
        {
          url: 'https://api.github.com/repos/octocat/Hello-World/labels/bug',
          name: 'bug',
          color: 'f29513',
        },
      ],
    };

    // Write a query that gets just the fields we want
    const query = gql`
      {
        title
        user {
          login
        }
        labels {
          name
        }
      }
    `;

    // Define a resolver that just returns a property
    const resolver = (fieldName, root) => root[fieldName];

    // Filter the data!
    const result = graphql(resolver, query, gitHubAPIResponse);

    expect(result).toEqual({
      title: 'Found a bug',
      user: {
        login: 'octocat',
      },
      labels: [
        {
          name: 'bug',
        },
      ],
    });
  });

  it('readme example 2', () => {
    // Write a query where the fields are types, but we alias them
    const query = gql`
      {
        author {
          name: string
          age: int
          address {
            state: string
          }
        }
      }
    `;

    // Define a resolver that uses the field name to determine the type
    // Note that we get the actual name, not the alias, but the alias
    // is used to determine the location in the response
    const resolver = fieldName =>
      ({ string: 'This is a string', int: 5 }[fieldName] || 'continue');

    // Generate the object!
    const result = graphql(resolver, query);

    expect(result).toEqual({
      author: {
        name: 'This is a string',
        age: 5,
        address: {
          state: 'This is a string',
        },
      },
    });
  });

  it('read from Redux normalized store', () => {
    const data = {
      result: [1, 2],
      entities: {
        articles: {
          1: { id: 1, title: 'Some Article', author: 1 },
          2: { id: 2, title: 'Other Article', author: 1 },
        },
        users: {
          1: { id: 1, name: 'Dan' },
        },
      },
    };

    const query = gql`
      {
        result {
          title
          author {
            name
          }
        }
      }
    `;

    const schema = {
      articles: {
        author: 'users',
      },
    };

    // This resolver is a bit more complex than others, since it has to
    // correctly handle the root object, values by ID, and scalar leafs.
    const resolver = (fieldName, rootValue, args, context): any => {
      if (!rootValue) {
        return context.result.map(id => {
          return {
            ...context.entities.articles[id],
            __typename: 'articles',
          };
        });
      }

      const typename = rootValue.__typename;
      // If this field is a reference according to the schema
      if (typename && schema[typename] && schema[typename][fieldName]) {
        // Get the target type, and get it from entities by ID
        const targetType: string = schema[typename][fieldName];
        return {
          ...context.entities[targetType][rootValue[fieldName]],
          __typename: targetType,
        };
      }

      // This field is just a scalar
      return rootValue[fieldName];
    };

    const result = graphql(
      resolver,
      query,
      null,
      data, // pass data as context since we have to access it all the time
    );

    // This is the non-normalized data, with only the fields we asked for in our query!
    expect(result).toEqual({
      result: [
        {
          title: 'Some Article',
          author: {
            name: 'Dan',
          },
        },
        {
          title: 'Other Article',
          author: {
            name: 'Dan',
          },
        },
      ],
    });
  });

  it('passes info including isLeaf, resultKey and directives', () => {
    const leafMap: { [s: string]: ExecInfo } = {};

    const resolver: Resolver = (fieldName, root, args, context, info) => {
      leafMap[fieldName] = info;
      return 'continue';
    };

    const query = gql`
      {
        alias: a {
          b
          hasDirective @skip(if: false) @otherDirective(arg: $x)
        }
      }
    `;

    graphql(resolver, query, null, null, { x: 'argument' });

    expect(leafMap).toEqual({
      a: {
        directives: null,
        isLeaf: false,
        resultKey: 'alias',
      },
      b: {
        directives: null,
        isLeaf: true,
        resultKey: 'b',
      },
      hasDirective: {
        directives: {
          skip: { if: false },
          otherDirective: { arg: 'argument' },
        },
        isLeaf: true,
        resultKey: 'hasDirective',
      },
    });
  });

  it('can filter GraphQL results', () => {
    const data = {
      alias: 'Bob',
      name: 'Wrong',
      height: 1.89,
      avatar: {
        square: 'abc',
        circle: 'def',
        triangle: 'qwe',
      },
    };

    const fragment = gql`
      fragment PersonDetails on Person {
        alias: name
        height(unit: METERS)
        avatar {
          square
          ... on Avatar {
            circle
          }
        }
      }
    `;

    const resolver: Resolver = (fieldName, root, args, context, info) => {
      return root[info.resultKey];
    };

    const filtered = graphql(resolver, fragment, data);

    expect(filtered).toEqual({
      alias: 'Bob',
      height: 1.89,
      avatar: {
        square: 'abc',
        circle: 'def',
      },
    });
  });

  it('can handle mutations', () => {
    const resolver = (fieldName, root, args) => {
      if (fieldName === 'operateOnNumbers') {
        return args;
      } else if (fieldName === 'add') {
        return root.a + root.b;
      } else if (fieldName === 'subtract') {
        return root.a - root.b;
      } else if (fieldName === 'multiply') {
        return root.a * root.b;
      } else if (fieldName === 'divide') {
        return root.a / root.b;
      }
    };

    const query = gql`
      mutation {
        operateOnNumbers(a: 10, b: 2) {
          add
          subtract
          multiply
          divide
        }
      }
    `;

    const result = graphql(resolver, query, '', null, null);

    expect(result).toEqual({
      operateOnNumbers: {
        add: 12,
        subtract: 8,
        multiply: 20,
        divide: 5,
      },
    });
  });

  it('can handle subscriptions', () => {
    const data = {
      user: {
        id: 1,
        name: 'Some User',
        height: 1.89,
      },
    };

    const resolver = (fieldName, root) => root[fieldName];

    const query = gql`
      subscription {
        user {
          id
          name
          height
        }
      }
    `;

    const result = graphql(resolver, query, data);

    expect(result).toEqual({
      user: {
        id: 1,
        name: 'Some User',
        height: 1.89,
      },
    });
  });

  it('can handle documents with multiple fragments', () => {
    const data = {
      user: {
        id: 1,
        name: 'Some User',
        height: 1.89,
      },
    };

    const resolver = (fieldName, root) => root[fieldName];

    const query = gql`
      fragment A on User {
        name
      }

      fragment B on User {
        height
      }

      query {
        user {
          id
          ...A
          ...B
        }
      }
    `;

    const result = graphql(resolver, query, data);

    expect(result).toEqual({
      user: {
        id: 1,
        name: 'Some User',
        height: 1.89,
      },
    });
  });
});
