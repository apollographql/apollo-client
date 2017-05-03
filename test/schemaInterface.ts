import { expect } from 'chai';
import {
  graphql,
  GraphQLString,
  GraphQLSchema,
  GraphQLObjectType,
  ExecutionResult,
} from 'graphql';

import gql from 'graphql-tag';

import ApolloClient from '../src';

import {
  createSchemaInterface,
} from '../src/transport/schemaInterface';

const RESOLVE_SYNC = 'sync resolve';
const RESOLVE_ASYNC = 'async resolve';
const RESOLVE_VARIABLE = 'resolve variable text:';
const RESOLVE_CONTEXT = 'resolve context text:';
const RESOLVE_ROOT_VALUE = 'resolve root value:';

describe('createSchemaInterface', () => {
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Root',
      fields: {
        sync: {
          type: GraphQLString,
          resolve() {
            return RESOLVE_SYNC;
          },
        },
        async: {
          type: GraphQLString,
          resolve() {
            return Promise.resolve(RESOLVE_ASYNC);
          },
        },
        variables: {
          type: GraphQLString,
          args: {
            text: { type: GraphQLString },
          },
          resolve(obj, { text }) {
            return `${RESOLVE_VARIABLE} ${text}`;
          },
        },
        context: {
          type: GraphQLString,
          resolve(obj, args, { text }) {
            return `${RESOLVE_CONTEXT} ${text}`;
          },
        },
        rootvalue: {
          type: GraphQLString,
          resolve(obj, args, context, { fieldName }) {
            return `${RESOLVE_ROOT_VALUE} ${fieldName}`;
          },
        },
      },
    }),
  });

  const client = new ApolloClient({
    networkInterface: createSchemaInterface(schema, { text: 'bar' }),
  });

  it('should resolve sync schema', () => {
    const query = gql`{ result: sync }`;
    return client.query({ query })
      .then(({ data: { result = '' } = {} }: ExecutionResult) => {
        expect(result).to.equal(RESOLVE_SYNC);
      });
  });

  it('should resolve async schema', () => {
    const query = gql`{ result: async }`;
    return client.query({ query })
      .then(({ data: { result = '' } = {} }: ExecutionResult) => {
        expect(result).to.equal(RESOLVE_ASYNC);
      });
  });

  it('should resolve using variables', () => {
    const query = gql`
      query result($value: String) {
        result: variables(text: $value)
      }
    `;
    const variables = {
      value: 'foo',
    };
    return client.query({ query, variables })
      .then(({ data: { result = '' } = {} }: ExecutionResult) => {
        expect(result).to.equal(`${RESOLVE_VARIABLE} foo`);
      });
  });

  it('should make context available', () => {
    const query = gql`{ result: context }`;
    return client.query({ query })
      .then(({ data: { result = '' } = {} }: ExecutionResult) => {
        expect(result).to.equal(`${RESOLVE_CONTEXT} bar`);
      });
  });

  it('should make root value available', () => {
    const query = gql`{ result: rootvalue }`;
    return client.query({ query })
      .then(({ data: { result = '' } = {} }: ExecutionResult) => {
        expect(result).to.equal(`${RESOLVE_ROOT_VALUE} rootvalue`);
      });
  });

});
