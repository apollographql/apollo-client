import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloLink, Observable } from 'apollo-link';
import gql from 'graphql-tag';

import ApolloClient from '../..';

describe('Default use', () => {
  it(
    'should add a schema string in SDL format to the context as definition ' +
      'if typeDefs are passed in',
    done => {
      const link = new ApolloLink(operation => {
        const { schemas } = operation.getContext();
        expect(schemas).toMatchSnapshot();
        return Observable.of({
          data: { foo: { bar: true, __typename: 'Bar' } },
        });
      });

      const typeDefs = `
        type Todo {
          id: String
          message: String!
        }

        type Query {
          todo(id: String!): Todo
        }
      `;

      const remoteQuery = gql`
        {
          foo {
            bar
          }
        }
      `;

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
        typeDefs,
      });

      client.query({ query: remoteQuery }).then(() => done(), done.fail);
    },
  );

  it('should concatenate schema strings if typeDefs are passed in as an array', done => {
    const anotherSchema = `
        type Foo {
          foo: String!
          bar: String
        }
      `;

    const link = new ApolloLink(operation => {
      const { schemas } = operation.getContext();
      expect(schemas).toMatchSnapshot();
      return Observable.of({
        data: { foo: { bar: true, __typename: 'Bar' } },
      });
    });

    const typeDefs = `
        type Todo {
          id: String
          message: String!
        }

        type Query {
          todo(id: String!): Todo
        }
      `;

    const remoteQuery = gql`
      {
        foo {
          bar
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      typeDefs: [typeDefs, anotherSchema],
    });

    client.query({ query: remoteQuery }).then(() => done(), done.fail);
  });
});
