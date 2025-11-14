import type { GraphQLSchema } from "graphql";
import { execute, validate } from "graphql";
import { Observable } from "rxjs";

import { ApolloLink } from "@apollo/client/link";

export declare namespace SchemaLink {
  export namespace SchemaLinkDocumentationTypes {
    /**
     * A function that returns the resolver context for a given operation.
     *
     * This function is called for each operation and allows you to create
     * operation-specific context. This is useful when you need to include
     * information from the operation (like headers, variables, etc.) in the
     * resolver context.
     *
     * @param operation - The Apollo Link operation
     * @returns The resolver context object or a promise that resolves to the context
     *
     * @example
     *
     * ```ts
     * const link = new SchemaLink({
     *   schema,
     *   context: (operation) => {
     *     return {
     *       userId: operation.getContext().userId,
     *       dataSources: {
     *         userAPI: new UserAPI(),
     *       },
     *     };
     *   },
     * });
     * ```
     */
    export function ResolverContextFunction(
      operation: ApolloLink.Operation
    ): SchemaLink.ResolverContext | PromiseLike<SchemaLink.ResolverContext>;
  }
  /**
   * The resolver context object passed to GraphQL resolvers.
   *
   * This context object is passed as the third parameter to GraphQL resolvers
   * and typically contains data-fetching connectors, authentication information,
   * and other request-specific data.
   */
  export type ResolverContext = Record<string, any>;

  /** {@inheritDoc @apollo/client/link/schema!SchemaLink.SchemaLinkDocumentationTypes.ResolverContextFunction:function(1)} */
  export type ResolverContextFunction = (
    operation: ApolloLink.Operation
  ) => SchemaLink.ResolverContext | PromiseLike<SchemaLink.ResolverContext>;

  /**
   * Options for configuring the `SchemaLink`.
   */
  export interface Options {
    /**
     * An executable GraphQL schema to use for operation execution.
     *
     * @remarks
     *
     * This should be a complete, executable GraphQL schema created using
     * tools like `makeExecutableSchema` from `@graphql-tools/schema` or
     * `buildSchema` from `graphql`.
     *
     * @example
     *
     * ```ts
     * import { makeExecutableSchema } from "@graphql-tools/schema";
     *
     * const schema = makeExecutableSchema({
     *   typeDefs,
     *   resolvers,
     * });
     *
     * const link = new SchemaLink({ schema });
     * ```
     */
    schema: GraphQLSchema;

    /**
     * The root value passed to root-level resolvers. It's typically not used in
     * most schemas but can be useful for certain advanced patterns.
     */
    rootValue?: any;

    /**
     * Context object or function that returns the context object to provide to
     * resolvers. The context is passed as the third parameter to all GraphQL
     * resolvers.
     *
     * - If a static object is provided, the same context will be used for all
     *   operations
     * - If a function is provided, the function is called for each operation to
     *   generate operation-specific context
     */
    context?: SchemaLink.ResolverContext | SchemaLink.ResolverContextFunction;

    /**
     * Whether to validate incoming queries against the schema before execution.
     *
     * When enabled, queries will be validated against the schema before execution,
     * and validation errors will be returned in the result's `errors` array,
     * just like a remote GraphQL server would.
     *
     * This is useful for testing and development to catch query errors early,
     * but may add overhead in production environments.
     *
     * @defaultValue false
     */
    validate?: boolean;
  }
}

/**
 * `SchemaLink` is a terminating link that executes GraphQL operations against
 * a local GraphQL schema instead of making network requests. This is commonly
 * used for server-side rendering (SSR) and mocking data.
 *
 * > [!NOTE]
 * > While `SchemaLink` can provide GraphQL results on the client, the GraphQL
 * > execution layer is [quite large](https://bundlephobia.com/result?p=graphql) for practical client-side use.
 * > For client-side state management, consider Apollo Client's [local state management](https://apollographql.com/docs/react/local-state/local-state-management/)
 * > functionality instead, which integrates with the Apollo Client cache.
 *
 * @example
 *
 * ```ts
 * import { SchemaLink } from "@apollo/client/link/schema";
 * import schema from "./path/to/your/schema";
 *
 * const link = new SchemaLink({ schema });
 * ```
 */
export class SchemaLink extends ApolloLink {
  public schema: SchemaLink.Options["schema"];
  public rootValue: SchemaLink.Options["rootValue"];
  public context: SchemaLink.Options["context"];
  public validate: boolean;

  constructor(options: SchemaLink.Options) {
    super();
    this.schema = options.schema;
    this.rootValue = options.rootValue;
    this.context = options.context;
    this.validate = !!options.validate;
  }

  public request(
    operation: ApolloLink.Operation
  ): Observable<ApolloLink.Result> {
    return new Observable<ApolloLink.Result>((observer) => {
      new Promise<SchemaLink.ResolverContext>((resolve) =>
        resolve(
          typeof this.context === "function" ?
            this.context(operation)
          : this.context
        )
      )
        .then((context) => {
          if (this.validate) {
            const validationErrors = validate(this.schema, operation.query);
            if (validationErrors.length > 0) {
              return { errors: validationErrors };
            }
          }

          return execute({
            schema: this.schema,
            document: operation.query,
            rootValue: this.rootValue,
            contextValue: context,
            variableValues: operation.variables,
            operationName: operation.operationName,
          });
        })
        .then((data) => {
          if (!observer.closed) {
            observer.next(data);
            observer.complete();
          }
        })
        .catch((error) => {
          if (!observer.closed) {
            observer.error(error);
          }
        });
    });
  }
}
