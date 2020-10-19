import { execute, GraphQLSchema } from 'graphql';

import { ApolloLink, Operation, FetchResult } from '../core';
import { Observable } from '../../utilities';

export namespace SchemaLink {
  export type ResolverContext = Record<string, any>;
  export type ResolverContextFunction = (
    operation: Operation,
  ) => ResolverContext | PromiseLike<ResolverContext>;

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
    context?: ResolverContext | ResolverContextFunction;
  }
}

export class SchemaLink extends ApolloLink {
  public schema: SchemaLink.Options["schema"];
  public rootValue: SchemaLink.Options["rootValue"];
  public context: SchemaLink.Options["context"];

  constructor(options: SchemaLink.Options) {
    super();
    this.schema = options.schema;
    this.rootValue = options.rootValue;
    this.context = options.context;
  }

  public request(operation: Operation): Observable<FetchResult> {
    return new Observable<FetchResult>(observer => {
      new Promise<SchemaLink.ResolverContext>(
        resolve => resolve(
          typeof this.context === 'function'
            ? this.context(operation)
            : this.context
        )
      ).then(context => execute(
        this.schema,
        operation.query,
        this.rootValue,
        context,
        operation.variables,
        operation.operationName,
      )).then(data => {
        if (!observer.closed) {
          observer.next(data);
          observer.complete();
        }
      }).catch(error => {
        if (!observer.closed) {
          observer.error(error);
        }
      });
    });
  }
}
