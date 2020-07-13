import { makeExecutableSchema } from 'graphql-tools';
import gql from 'graphql-tag';

import { execute } from '../../core/execute';
import { SchemaLink } from '../';

const sampleQuery = gql`
  query SampleQuery {
    sampleQuery {
      id
    }
  }
`;

const typeDefs = `
type Stub {
  id: String
}

type Query {
  sampleQuery: Stub
}
`;

const schema = makeExecutableSchema({ typeDefs });

describe('SchemaLink', () => {
  const mockError = { throws: new TypeError('mock me') };

  it('raises warning if called with concat', () => {
    const link = new SchemaLink({ schema });
    const _warn = console.warn;
    console.warn = (warning: any) => expect(warning['message']).toBeDefined();
    expect(link.concat((operation, forward) => forward(operation))).toEqual(
      link,
    );
    console.warn = _warn;
  });

  it('throws if no arguments given', () => {
    expect(() => new (SchemaLink as any)()).toThrow();
  });

  it('correctly receives the constructor arguments', () => {
    let rootValue = {};
    let link = new SchemaLink({ schema, rootValue });
    expect(link.rootValue).toEqual(rootValue);
    expect(link.schema).toEqual(schema);
  });

  it('calls next and then complete', done => {
    const next = jest.fn();
    const link = new SchemaLink({ schema });
    const observable = execute(link, {
      query: sampleQuery,
    });
    observable.subscribe({
      next,
      error: error => expect(false),
      complete: () => {
        expect(next).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  it('calls error when fetch fails', done => {
    const badSchema = makeExecutableSchema({ typeDefs });

    const link = new SchemaLink({ schema: badSchema });
    const observable = execute(link, {
      query: sampleQuery,
    });
    observable.subscribe(
      result => expect(false),
      error => {
        expect(error).toEqual(mockError.throws);
        done();
      },
      () => {
        expect(false);
        done();
      },
    );
  });

  it('supports query which is executed synchronously', done => {
    const next = jest.fn();
    const link = new SchemaLink({ schema });
    const introspectionQuery = gql`
      query IntrospectionQuery {
        __schema {
          types {
            name
          }
        }
      }
    `;
    const observable = execute(link, {
      query: introspectionQuery,
    });
    observable.subscribe(
      next,
      error => expect(false),
      () => {
        expect(next).toHaveBeenCalledTimes(1);
        done();
      },
    );
  });

  it('passes operation context into execute with context function', done => {
    const next = jest.fn();
    const contextValue = { some: 'value' };
    const contextProvider = jest.fn(operation => operation.getContext());
    const resolvers = {
      Query: {
        sampleQuery: (root: any, args: any, context: any) => {
          try {
            expect(context).toEqual(contextValue);
          } catch (error) {
            done.fail('Should pass context into resolver');
          }
        },
      },
    };
    const schemaWithResolvers = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
    const link = new SchemaLink({
      schema: schemaWithResolvers,
      context: contextProvider,
    });
    const observable = execute(link, {
      query: sampleQuery,
      context: contextValue,
    });
    observable.subscribe(
      next,
      error => done.fail("Shouldn't call onError"),
      () => {
        try {
          expect(next).toHaveBeenCalledTimes(1);
          expect(contextProvider).toHaveBeenCalledTimes(1);
          done();
        } catch (e) {
          done.fail(e);
        }
      },
    );
  });

  it('passes static context into execute', done => {
    const next = jest.fn();
    const contextValue = { some: 'value' };
    const resolver = jest.fn((root, args, context) => {
      try {
        expect(context).toEqual(contextValue);
      } catch (error) {
        done.fail('Should pass context into resolver');
      }
    });

    const resolvers = {
      Query: {
        sampleQuery: resolver,
      },
    };
    const schemaWithResolvers = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
    const link = new SchemaLink({
      schema: schemaWithResolvers,
      context: contextValue,
    });
    const observable = execute(link, {
      query: sampleQuery,
    });
    observable.subscribe(
      next,
      error => done.fail("Shouldn't call onError"),
      () => {
        try {
          expect(next).toHaveBeenCalledTimes(1);
          expect(resolver).toHaveBeenCalledTimes(1);
          done();
        } catch (e) {
          done.fail(e);
        }
      },
    );
  });
});
