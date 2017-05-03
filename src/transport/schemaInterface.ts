import {
  graphql,
  ExecutionResult,
  GraphQLSchema,
} from 'graphql';

import {
  NetworkInterface,
  Request,
} from './networkInterface';

import { print } from 'graphql/language/printer';

// Provides an interface to a local graphql schema
export class SchemaInterface implements NetworkInterface {
  constructor(private schema: GraphQLSchema, private contextValue?: any) {}

  public query({ query, variables, operationName, rootValue = {} }: Request): Promise<ExecutionResult> {
    return graphql(this.schema, print(query), rootValue, this.contextValue, variables, operationName);
  }
}

// Creates an interface for a graphql schema
export function createSchemaInterface( schema: GraphQLSchema, contextValue?: Object ): NetworkInterface {
  return new SchemaInterface(schema, contextValue);
}

