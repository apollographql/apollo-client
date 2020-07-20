import { execute } from 'graphql/execution/execute';
import { GraphQLSchema } from 'graphql/type/schema';

import { ApolloLink, Operation, FetchResult } from '../core';
import { Observable } from '../../utilities';

export namespace SchemaLink {
  export type ResolverContextFunction = (
    operation: Operation,
  ) => Record<string, any>;

  export interface Options {
    /**
     * The schema to generate responses from.
     */
    schema: GraphQLSchema;

    /**
     * The root value to use when generating responses.
     */
    rootValue?: any;

    /**
     * A context to provide to resolvers declared within the schema.
     */
    context?: ResolverContextFunction | Record<string, any>;
  }
}

export class SchemaLink extends ApolloLink {
  public schema: GraphQLSchema;
  public rootValue: any;
  public context: SchemaLink.ResolverContextFunction | any;

  constructor({ schema, rootValue, context }: SchemaLink.Options) {
    super();

    this.schema = schema;
    this.rootValue = rootValue;
    this.context = context;
  }

  public request(operation: Operation): Observable<FetchResult> | null {
    return new Observable<FetchResult>(observer => {
      Promise.resolve(
        execute(
          this.schema,
          operation.query,
          this.rootValue,
          typeof this.context === 'function'
            ? this.context(operation)
            : this.context,
          operation.variables,
          operation.operationName,
        ),
      )
        .then(data => {
          if (!observer.closed) {
            observer.next(data);
            observer.complete();
          }
        })
        .catch(error => {
          if (!observer.closed) {
            observer.error(error);
          }
        });
    });
  }
}
