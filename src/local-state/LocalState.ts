import type {
  ASTNode,
  DirectiveNode,
  DocumentNode,
  ExecutableDefinitionNode,
  FieldNode,
  FormattedExecutionResult,
  FragmentSpreadNode,
  GraphQLError,
  GraphQLFormattedError,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from "graphql";
import { isSelectionNode, Kind, visit } from "graphql";

import type {
  ApolloCache,
  ApolloClient,
  Cache,
  DefaultContext,
  ErrorLike,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { cacheSlot } from "@apollo/client/cache";
import { LocalStateError, toErrorLike } from "@apollo/client/errors";
import { stripTypename } from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type {
  FragmentMap,
  NoInfer,
  RemoveIndexSignature,
} from "@apollo/client/utilities/internal";
import {
  argumentsObjectFromField,
  createFragmentMap,
  dealias,
  getFragmentDefinitions,
  getMainDefinition,
  hasDirectives,
  mergeDeep,
  mergeDeepArray,
  resultKeyNameFromField,
  shouldInclude,
} from "@apollo/client/utilities/internal";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

interface ExecContext {
  client: ApolloClient;
  operationDefinition: OperationDefinitionNode;
  fragmentMap: FragmentMap;
  context: unknown;
  variables: OperationVariables;
  exportedVariables: OperationVariables;
  onlyRunForcedResolvers: boolean;
  selectionsToResolve: Set<SelectionNode>;
  errors: GraphQLFormattedError[];
  phase: "exports" | "resolve";
  exportedVariableDefs: Record<string, ExportedVariable>;
  diff: Cache.DiffResult<any>;
  returnPartialData: boolean;
}

/**
 * Information about an exported variable defined by an `@export` directive.
 */
interface ExportedVariable {
  /**
   * Defines whether an exported variable is a required variable (i.e. a non-null variable)
   */
  required: boolean;
  /**
   * The `FieldNode` where the exported variable is defined.
   */
  field?: FieldNode;

  /**
   * Ancestor nodes (parent, grandparent, etc.) that contain the `@export`
   * directive node. This is useful to get access to nested fields that contain
   * an `@export` directive if a parent resolver throws or returns
   * `null`/`undefined` that would otherwise prevent us from traversing the
   * node.
   */
  ancestors: WeakSet<ASTNode>;
}

/**
 * Tracks and caches information related to a GraphQL document by traversing the
 * document the first time its seen and collecting information about it.
 */
interface TraverseCacheEntry {
  /**
   * Tracks information about the variable definition for any variables defined
   * by an `@export` directive.
   */
  exportedVariableDefs: Record<string, ExportedVariable>;

  /**
   * SelectionNodes that either directly contain or include an `@export` field
   * in its selection set. This allows us to avoid traversing subtrees that do
   * not contain `@export` fields.
   */
  exportsToResolve: Set<SelectionNode>;

  /**
   * SelectionNodes that either directly contain or include an `@client` field
   * in its selection set. This allows us to avoid traversing subtrees that do
   * not contain `@client` fields.
   */
  selectionsToResolve: Set<SelectionNode>;
}

type InferContextValueFromResolvers<TResolvers> =
  TResolvers extends { [typename: string]: infer TFieldResolvers } ?
    TFieldResolvers extends (
      { [field: string]: LocalState.Resolver<any, any, infer TContext, any> }
    ) ?
      unknown extends TContext ?
        DefaultContext
      : TContext
    : DefaultContext
  : DefaultContext;

type MaybeRequireContextFunction<TContext> =
  {} extends RemoveIndexSignature<TContext> ? {}
  : { context: LocalState.ContextFunction<TContext> };

export declare namespace LocalState {
  // `rootValue` can be any value, but using `any` or `unknown` does not allow
  // the ability to add a function signature to this definition. The generic
  // allows us to provide the function signature while allowing any value.

  /**
   * Configuration options for LocalState.
   *
   * @template TResolvers - The type of resolvers map to use for type checking
   * @template TContext - The type of context value returned by the context function. Defaults to `DefaultContext` when not provided.
   */
  export type Options<
    TResolvers extends Resolvers = Resolvers,
    TContext = DefaultContext,
  > = {
    context?: ContextFunction<TContext>;

    /**
     * The map of resolvers used to provide values for `@local` fields.
     */
    resolvers?: TResolvers;
  } & MaybeRequireContextFunction<TContext>;

  export interface RootValueFunctionContext {
    document: DocumentNode;
    client: ApolloClient;
    context: DefaultContext;
    phase: "exports" | "resolve";
    variables: OperationVariables;
  }

  export type ContextFunction<TContext> = (
    options: ContextFunctionOptions
  ) => TContext;

  export interface ContextFunctionOptions {
    document: DocumentNode;
    client: ApolloClient;
    phase: "exports" | "resolve";
    variables: OperationVariables;
    requestContext: DefaultContext;
  }

  export type RootValueFunction<TRootValue> = (
    context: RootValueFunctionContext
  ) => TRootValue;

  /**
   * A map of GraphQL types to their field resolvers.
   *
   * @example
   *
   * ```ts
   * const resolvers: Resolvers = {
   *   Query: {
   *     isLoggedIn: () => !!localStorage.getItem("token"),
   *   },
   *   Mutation: {
   *     login: (_, { token }) => {
   *       localStorage.setItem("token", token);
   *       return true;
   *     },
   *   },
   * };
   * ```
   */
  export interface Resolvers<TContext = any> {
    [typename: string]: {
      [field: string]: Resolver<any, any, TContext, any>;
    };
  }

  /**
   * A function that resolves the value for a single GraphQL field marked with `@client`.
   *
   * Resolver functions receive four parameters:
   *
   * - `rootValue`: The parent object containing the result from the resolver on the parent field
   * - `args`: Arguments passed to the field
   * - `context`: Contains `requestContext`, `client`, and `phase` properties
   * - `info`: Information about the field being resolved
   *
   * @template TResult - The type of value returned by the resolver
   * @template TParent - The type of the parent object
   * @template TContext - The type of the request context
   * @template TArgs - The type of the field arguments
   *
   * @example
   *
   * ```ts
   * const isLoggedInResolver: Resolver<boolean> = () => {
   *   return !!localStorage.getItem("token");
   * };
   * ```
   */
  export type Resolver<
    TResult = unknown,
    TParent = unknown,
    TContext = DefaultContext,
    TArgs = Record<string, unknown>,
  > = (
    rootValue: TParent,
    args: TArgs,
    context: {
      requestContext: TContext;
      client: ApolloClient;
      phase: "exports" | "resolve";
    },
    info: {
      field: FieldNode;
      fragmentMap: FragmentMap;
      path: Path;
    }
  ) => TResult | Promise<TResult>;

  export type Path = Array<string | number>;
}

/**
 * LocalState enables the use of `@client` fields in GraphQL operations.
 *
 * `@client` fields are resolved locally using resolver functions rather than
 * being sent to the GraphQL server. This allows you to mix local and remote
 * data in a single query.
 *
 * @example
 *
 * ```ts
 * import { LocalState } from "@apollo/client/local-state";
 *
 * const localState = new LocalState({
 *   resolvers: {
 *     Query: {
 *       isLoggedIn: () => !!localStorage.getItem("token"),
 *     },
 *   },
 * });
 *
 * const client = new ApolloClient({
 *   cache: new InMemoryCache(),
 *   localState,
 * });
 * ```
 *
 * @template TResolvers - The type of resolvers map for type checking
 * @template TContext - The type of context value for resolvers
 */
export class LocalState<
  TResolvers extends
    LocalState.Resolvers = LocalState.Resolvers<DefaultContext>,
  TContext = InferContextValueFromResolvers<TResolvers>,
> {
  private context?: LocalState.ContextFunction<TContext>;
  private resolvers: LocalState.Resolvers = {};
  private traverseCache = new WeakMap<
    ExecutableDefinitionNode,
    TraverseCacheEntry
  >();

  constructor(
    ...[options]: {} extends TResolvers ?
      [options?: LocalState.Options<TResolvers, NoInfer<TContext>>]
    : [
        options: LocalState.Options<TResolvers, NoInfer<TContext>> & {
          resolvers: TResolvers;
        },
      ]
  ) {
    this.context = options?.context;

    if (options?.resolvers) {
      this.addResolvers(options.resolvers);
    }
  }

  /**
   * Add resolvers to the local state. New resolvers will be merged with
   * existing ones, with new resolvers taking precedence over existing ones
   * for the same field.
   *
   * @param resolvers - The resolvers to add
   *
   * @example
   *
   * ```ts
   * localState.addResolvers({
   *   Query: {
   *     newField: () => "Hello World",
   *   },
   * });
   * ```
   */
  public addResolvers(resolvers: TResolvers) {
    this.resolvers = mergeDeep(this.resolvers, resolvers);
  }

  public async execute<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >({
    document,
    client,
    context,
    remoteResult,
    variables = {} as TVariables,
    onlyRunForcedResolvers = false,
    returnPartialData = false,
  }: {
    document: DocumentNode | TypedDocumentNode<TData, TVariables>;
    client: ApolloClient;
    context: DefaultContext | undefined;
    // undefined is meant for client-only queries where there is no remote result
    remoteResult: FormattedExecutionResult<any> | undefined;
    variables: TVariables | undefined;
    onlyRunForcedResolvers?: boolean;
    returnPartialData?: boolean;
  }): Promise<FormattedExecutionResult<TData>> {
    if (__DEV__) {
      invariant(
        hasDirectives(["client"], document),
        "Expected document to contain `@client` fields."
      );

      validateCacheImplementation(client.cache);
    }

    // note: if `remoteResult` is `undefined`, we will execute resolvers since
    // undefined remote data reflects a client-only query. We specifically want
    // to avoid trying to run local resolvers if the server returned `data` as
    // `null`.
    if (remoteResult?.data === null) {
      return remoteResult;
    }

    const {
      selectionsToResolve,
      exportedVariableDefs,
      operationDefinition,
      fragmentMap,
    } = this.collectQueryDetail(document);

    const rootValue = remoteResult ? remoteResult.data : {};

    const diff = client.cache.diff<Record<string, any>>({
      query: toQueryOperation(document),
      variables,
      returnPartialData: true,
      optimistic: false,
    });

    const requestContext = { ...client.defaultContext, ...context };
    const execContext: ExecContext = {
      client,
      operationDefinition,
      fragmentMap,
      context:
        this.context?.({
          requestContext,
          document,
          client,
          phase: "resolve",
          variables: variables ?? {},
        }) ?? (requestContext as TContext),
      variables,
      exportedVariables: {},
      selectionsToResolve,
      onlyRunForcedResolvers,
      errors: [],
      phase: "resolve",
      exportedVariableDefs,
      diff,
      returnPartialData,
    };

    const localResult = await this.resolveSelectionSet(
      operationDefinition.selectionSet,
      false,
      rootValue,
      execContext,
      []
    );

    const errors = (remoteResult?.errors ?? []).concat(execContext.errors);

    const result: FormattedExecutionResult<any> = {
      ...remoteResult,
      data: mergeDeep(rootValue, localResult),
    };

    if (errors.length > 0) {
      result.errors = errors;
    }

    return result;
  }

  public async getExportedVariables<
    TVariables extends OperationVariables = OperationVariables,
  >({
    document,
    client,
    context,
    variables,
  }: {
    document: DocumentNode | TypedDocumentNode<any, TVariables>;
    client: ApolloClient;
    context: DefaultContext | undefined;
    variables: Partial<NoInfer<TVariables>>;
  }): Promise<TVariables> {
    if (__DEV__) {
      invariant(
        hasDirectives(["client"], document),
        "Expected document to contain `@client` fields."
      );
      validateCacheImplementation(client.cache);
    }
    const {
      exportsToResolve,
      exportedVariableDefs,
      fragmentMap,
      operationDefinition,
    } = this.collectQueryDetail(document);

    const diff = client.cache.diff<Record<string, any>>({
      query: toQueryOperation(document),
      variables,
      returnPartialData: true,
      optimistic: false,
    });

    const requestContext = { ...client.defaultContext, ...context };
    const execContext: ExecContext = {
      client,
      operationDefinition,
      fragmentMap,
      context:
        this.context?.({
          requestContext,
          document,
          client,
          phase: "resolve",
          variables: variables ?? {},
        }) ?? (requestContext as TContext),
      variables,
      exportedVariables: {},
      selectionsToResolve: exportsToResolve,
      onlyRunForcedResolvers: false,
      errors: [],
      phase: "exports",
      exportedVariableDefs,
      diff,
      returnPartialData: false,
    };

    await this.resolveSelectionSet(
      operationDefinition.selectionSet,
      false,
      diff.result,
      execContext,
      []
    );

    return stripTypename({
      ...variables,
      ...execContext.exportedVariables,
    }) as TVariables;
  }

  private async resolveSelectionSet(
    selectionSet: SelectionSetNode,
    isClientFieldDescendant: boolean,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: LocalState.Path
  ) {
    const { client, fragmentMap, variables, operationDefinition } = execContext;
    const { cache } = client;
    const resultsToMerge: Array<Record<string, any>> = [];

    const execute = async (selection: SelectionNode): Promise<void> => {
      if (
        !isClientFieldDescendant &&
        !execContext.selectionsToResolve.has(selection)
      ) {
        // Skip selections without @client directives
        // (still processing if one of the ancestors or one of the child fields has @client directive)
        return;
      }
      if (!shouldInclude(selection, variables)) {
        // Skip this entirely.
        return;
      }

      if (selection.kind === Kind.FIELD) {
        const isRootField = selectionSet === operationDefinition.selectionSet;
        const isClientField =
          isClientFieldDescendant ||
          (selection.directives?.some((d) => d.name.value === "client") ??
            false);

        const fieldResult =
          isClientField ?
            await this.resolveClientField(
              selection,
              isClientFieldDescendant,
              rootValue,
              execContext,
              selectionSet,
              path.concat(selection.name.value)
            )
          : await this.resolveServerField(
              selection,
              rootValue,
              execContext,
              path.concat(selection.name.value)
            );

        // Don't attempt to merge the client field result if the server result
        // was null
        if (fieldResult !== undefined && (!isRootField || rootValue !== null)) {
          resultsToMerge.push({
            [resultKeyNameFromField(selection)]: fieldResult,
          });
        }

        return;
      }

      if (
        selection.kind === Kind.INLINE_FRAGMENT &&
        selection.typeCondition &&
        rootValue?.__typename &&
        cache.fragmentMatches(selection, rootValue.__typename)
      ) {
        const fragmentResult = await this.resolveSelectionSet(
          selection.selectionSet,
          isClientFieldDescendant,
          rootValue,
          execContext,
          path
        );

        if (fragmentResult) {
          resultsToMerge.push(fragmentResult);
        }

        return;
      }

      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragment = fragmentMap[selection.name.value];
        invariant(fragment, "No fragment named %s", selection.name.value);

        const typename = rootValue?.__typename;
        const typeCondition = fragment.typeCondition.name.value;

        const matches =
          typename === typeCondition ||
          cache.fragmentMatches(fragment, typename ?? "");

        if (matches) {
          const fragmentResult = await this.resolveSelectionSet(
            fragment.selectionSet,
            isClientFieldDescendant,
            rootValue,
            execContext,
            path
          );

          if (fragmentResult) {
            resultsToMerge.push(fragmentResult);
          }
        }

        return;
      }
    };

    await Promise.all(selectionSet.selections.map(execute));

    return resultsToMerge.length > 0 ?
        mergeDeepArray(resultsToMerge)
      : rootValue;
  }

  private resolveServerField(
    field: FieldNode,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: LocalState.Path
  ) {
    const result = rootValue?.[field.name.value];

    if (!field.selectionSet) {
      return result;
    }

    if (result == null) {
      if (execContext.phase === "exports") {
        for (const [name, def] of Object.entries(
          execContext.exportedVariableDefs
        )) {
          if (def.ancestors.has(field) && def.required) {
            throw new LocalStateError(
              `${"Field"} '${field.name.value}' is \`${result}\` which contains exported required variable '${name}'. Ensure this value is in the cache or make the variable optional.`,
              { path }
            );
          }
        }
      }

      return result;
    }

    if (Array.isArray(result)) {
      return this.resolveSubSelectedArray(
        field,
        false,
        result,
        execContext,
        path
      );
    }

    return this.resolveSelectionSet(
      field.selectionSet,
      false,
      result,
      execContext,
      path
    );
  }

  private async resolveClientField(
    field: FieldNode,
    isClientFieldDescendant: boolean,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    parentSelectionSet: SelectionSetNode,
    path: LocalState.Path
  ): Promise<any> {
    const {
      client,
      diff,
      variables,
      operationDefinition,
      phase,
      returnPartialData,
      onlyRunForcedResolvers,
    } = execContext;
    const isRootField = parentSelectionSet === operationDefinition.selectionSet;
    const fieldName = field.name.value;
    const typename =
      isRootField ?
        rootValue?.__typename || inferRootTypename(operationDefinition)
      : rootValue?.__typename;
    const resolverName = `${typename}.${fieldName}`;

    function readField() {
      const fieldResult = rootValue?.[fieldName];

      if (fieldResult !== undefined) {
        return fieldResult;
      }

      return getCacheResultAtPath(diff, path);
    }

    const defaultResolver =
      isClientFieldDescendant ? readField
        // We expect a resolver to be defined for all `@client` root fields.
        // Warn when a resolver is not defined.
      : (
        () => {
          const fieldFromCache = getCacheResultAtPath(diff, path);

          if (fieldFromCache !== undefined) {
            return fieldFromCache;
          }

          if (!returnPartialData) {
            return null;
          }
        }
      );

    const resolver = this.getResolver(typename, fieldName);
    let result: unknown;

    try {
      // Avoid running the resolver if we are only trying to run forced
      // resolvers. Fallback to read the value from the root field or the cache
      // value
      if (!onlyRunForcedResolvers || isForcedResolver(field)) {
        result =
          resolver ?
            await Promise.resolve(
              // In case the resolve function accesses reactive variables,
              // set cacheSlot to the current cache instance.
              cacheSlot.withValue(client.cache, resolver, [
                rootValue ? dealias(rootValue, parentSelectionSet) : {},
                (argumentsObjectFromField(field, variables) ?? {}) as Record<
                  string,
                  unknown
                >,
                { requestContext: execContext.context as any, client, phase },
                { field, fragmentMap: execContext.fragmentMap, path },
              ])
            )
          : defaultResolver();
      } else {
        result = readField();
      }
    } catch (e) {
      if (phase === "exports") {
        for (const [name, def] of Object.entries(
          execContext.exportedVariableDefs
        )) {
          if (def.ancestors.has(field)) {
            throw new LocalStateError(
              `An error was thrown from resolver '${resolverName}' while resolving ${
                def.required ? "required" : "optional"
              } variable '${name}'. Use a try/catch and return \`undefined\` to suppress this error and omit the variable from the request.`,
              { path, sourceError: e }
            );
          }
        }
      }

      this.addError(toErrorLike(e), path, execContext, {
        resolver: resolverName,
        cause: e,
      });
      return null;
    }

    if (phase === "exports") {
      field.directives?.forEach((directive) => {
        if (directive.name.value !== "export") {
          return;
        }

        const name = getExportedVariableName(directive);

        if (!name) {
          return;
        }

        if (result !== undefined) {
          execContext.exportedVariables[name] = result;
        }
      });

      if (result == null) {
        for (const [name, def] of Object.entries(
          execContext.exportedVariableDefs
        )) {
          if (def.ancestors.has(field) && def.required) {
            throw new LocalStateError(
              `${
                resolver ? "Resolver" : "Field"
              } '${resolverName}' returned \`${result}\` ${
                def.field === field ? "for" : "which contains exported"
              } required variable '${name}'.`,
              { path }
            );
          }
        }
      }
    }

    if (result === undefined && !returnPartialData) {
      if (__DEV__ && phase === "resolve") {
        if (resolver && !onlyRunForcedResolvers) {
          invariant.warn(
            "The '%s' resolver returned `undefined` instead of a value. This is likely a bug in the resolver. If you didn't mean to return a value, return `null` instead.",
            resolverName
          );
        } else if (onlyRunForcedResolvers) {
          invariant.warn(
            "The '%s' field had no cached value and only forced resolvers were run. The value was set to `null`.",
            resolverName
          );
        } else {
          invariant.warn(
            "The '%s' field on object %o returned `undefined` instead of a value. The parent resolver did not include the property in the returned value and there was no resolver defined for the field.",
            fieldName,
            rootValue
          );
        }
      }

      result = null;
    }

    if (result == null || !field.selectionSet) {
      return result;
    }

    if (Array.isArray(result)) {
      return this.resolveSubSelectedArray(
        field,
        true,
        result,
        execContext,
        path
      );
    }

    if (phase === "resolve" && !(result as any).__typename) {
      this.addError(
        newInvariantError(
          "Could not resolve __typename on object %o returned from resolver '%s'. '__typename' needs to be returned to properly resolve child fields.",
          result,
          resolverName
        ),
        path,
        execContext,
        { resolver: resolverName }
      );

      return null;
    }

    return this.resolveSelectionSet(
      field.selectionSet,
      true,
      result,
      execContext,
      path
    );
  }

  private addError(
    error: ErrorLike,
    path: LocalState.Path,
    execContext: ExecContext,
    meta: { [key: string]: any; resolver: string }
  ) {
    execContext.errors.push(
      addExtension(
        isGraphQLError(error) ?
          { ...error.toJSON(), path }
        : { message: error.message, path },
        meta
      )
    );
  }

  private getResolver(
    typename: string,
    fieldName: string
  ): LocalState.Resolver | undefined {
    return this.resolvers[typename]?.[fieldName];
  }

  private resolveSubSelectedArray(
    field: FieldNode,
    isClientFieldDescendant: boolean,
    result: any[],
    execContext: ExecContext,
    path: LocalState.Path
  ): any {
    return Promise.all(
      result.map((item, idx) => {
        if (item === null) {
          return null;
        }

        // This is a nested array, recurse.
        if (Array.isArray(item)) {
          return this.resolveSubSelectedArray(
            field,
            isClientFieldDescendant,
            item,
            execContext,
            path.concat(idx)
          );
        }

        // This is an object, run the selection set on it.
        if (field.selectionSet) {
          return this.resolveSelectionSet(
            field.selectionSet,
            isClientFieldDescendant,
            item,
            execContext,
            path.concat(idx)
          );
        }
      })
    );
  }

  // Collect selection nodes on paths from document root down to all @client directives.
  // This function takes into account transitive fragment spreads.
  // Complexity equals to a single `visit` over the full document.
  private collectQueryDetail(document: DocumentNode): TraverseCacheEntry & {
    operationDefinition: OperationDefinitionNode;
    fragmentMap: FragmentMap;
  } {
    const operationDefinition = getMainDefinition(
      document
    ) as OperationDefinitionNode;
    const fragments = getFragmentDefinitions(document);
    const fragmentMap = createFragmentMap(fragments);

    const isSingleASTNode = (
      node: ASTNode | readonly ASTNode[]
    ): node is ASTNode => !Array.isArray(node);
    const fields: Array<FieldNode> = [];
    let rootClientField: FieldNode | undefined;

    function getCurrentPath() {
      return fields.map((field) => field.name.value);
    }

    const traverse = (definitionNode: ExecutableDefinitionNode) => {
      if (this.traverseCache.has(definitionNode)) {
        return this.traverseCache.get(definitionNode)!;
      }

      // Track a separate list of all variable definitions since not all variable
      // definitions are used as exports of an `@export` field.
      const allVariableDefinitions: TraverseCacheEntry["exportedVariableDefs"] =
        {};

      const cache: TraverseCacheEntry = {
        exportedVariableDefs: {},
        exportsToResolve: new Set<SelectionNode>(),
        selectionsToResolve: new Set<SelectionNode>(),
      };
      this.traverseCache.set(definitionNode, cache);

      visit(definitionNode, {
        VariableDefinition: (definition) => {
          allVariableDefinitions[definition.variable.name.value] = {
            required: definition.type.kind === Kind.NON_NULL_TYPE,
            ancestors: new WeakSet(),
          };
        },
        Field: {
          enter(field) {
            fields.push(field);
          },
          leave() {
            const removed = fields.pop();

            if (removed === rootClientField) {
              rootClientField = undefined;
            }
          },
        },
        Directive(node: DirectiveNode, _, __, ___, ancestors) {
          const field = fields.at(-1);

          if (!field) {
            return;
          }

          if (
            node.name.value === "export" &&
            // Ignore export directives that aren't inside client fields.
            // These will get sent to the server
            rootClientField
          ) {
            const fieldName = field.name.value;
            const variableName = getExportedVariableName(node);
            if (!variableName) {
              throw new LocalStateError(
                `Cannot determine the variable name from the \`@export\` directive used on field '${fieldName}'. Perhaps you forgot the \`as\` argument?`,
                { path: getCurrentPath() }
              );
            }
            if (!allVariableDefinitions[variableName]) {
              throw new LocalStateError(
                `\`@export\` directive on field '${fieldName}' cannot export the '$${variableName}' variable as it is missing in the ${operationDefinition.operation} definition.`,
                { path: getCurrentPath() }
              );
            }
            cache.exportedVariableDefs[variableName] = {
              ...allVariableDefinitions[variableName],
              field,
            };
            ancestors.forEach((node) => {
              if (isSingleASTNode(node) && isSelectionNode(node)) {
                cache.exportsToResolve.add(node);
                cache.exportedVariableDefs[variableName].ancestors.add(node);
              }
            });
          }
          if (node.name.value === "client") {
            rootClientField ??= field;
            ancestors.forEach((node) => {
              if (isSingleASTNode(node) && isSelectionNode(node)) {
                cache.selectionsToResolve.add(node);
              }
            });
          }
        },
        FragmentSpread(spread: FragmentSpreadNode, _, __, ___, ancestors) {
          const fragment = fragmentMap[spread.name.value];
          invariant(fragment, `No fragment named %s`, spread.name.value);

          const { selectionsToResolve: fragmentSelections } =
            traverse(fragment);

          if (fragmentSelections.size > 0) {
            // Fragment for this spread contains @client directive (either directly or transitively)
            // Collect selection nodes on paths from the root down to fields with the @client directive
            ancestors.forEach((node) => {
              if (isSingleASTNode(node) && isSelectionNode(node)) {
                cache.selectionsToResolve.add(node);
              }
            });
            cache.selectionsToResolve.add(spread);
            fragmentSelections.forEach((selection) => {
              cache.selectionsToResolve.add(selection);
            });
          }
        },
      });

      return cache;
    };

    return {
      ...traverse(operationDefinition),
      operationDefinition,
      fragmentMap,
    };
  }
}

function inferRootTypename({ operation }: OperationDefinitionNode) {
  return operation.charAt(0).toUpperCase() + operation.slice(1);
}

// eslint-disable-next-line @typescript-eslint/no-restricted-types
function isGraphQLError(error: ErrorLike): error is GraphQLError {
  return (
    error.name === "GraphQLError" &&
    // Check to see if the error contains keys returned in toJSON. The values
    // might be `undefined` if not set, but we don't care about those as we
    // can be reasonably sure this is a GraphQLError if all of these properties
    // exist on the error
    "path" in error &&
    "locations" in error &&
    "extensions" in error
  );
}

function addExtension(error: GraphQLFormattedError, meta: Record<string, any>) {
  return {
    ...error,
    extensions: {
      ...error.extensions,
      localState: meta,
    },
  };
}

function getExportedVariableName(directive: DirectiveNode) {
  if (directive.arguments) {
    for (const arg of directive.arguments) {
      if (arg.name.value === "as" && arg.value.kind === Kind.STRING) {
        return arg.value.value;
      }
    }
  }
}

function validateCacheImplementation(cache: ApolloCache) {
  invariant(
    cache.fragmentMatches,
    "The configured cache does not support fragment matching which will lead to incorrect results when executing local resolvers. Please use a cache that implements `fragmetMatches`."
  );
}

function getCacheResultAtPath(
  diff: Cache.DiffResult<any>,
  path: LocalState.Path
) {
  if (diff.result === null) {
    // Intentionally return undefined to signal we have no cache data
    return;
  }

  return path.reduce((value, segment) => value?.[segment], diff.result);
}

function isForcedResolver(field: FieldNode) {
  return (
    field.directives?.some((directive) => {
      if (directive.name.value !== "client" || !directive.arguments) {
        return false;
      }

      return directive.arguments.some(
        (arg) =>
          arg.name.value === "always" &&
          arg.value.kind === "BooleanValue" &&
          arg.value.value === true
      );
    }) ?? false
  );
}

// If the incoming document is a query, return it as is. Otherwise, build a
// new document containing a query operation based on the selection set
// of the previous main operation.
function toQueryOperation(document: DocumentNode): DocumentNode {
  const definition = getMainDefinition(document);
  const definitionOperation = (definition as OperationDefinitionNode).operation;

  if (definitionOperation === "query") {
    // Already a query, so return the existing document.
    return document;
  }

  // Build a new query using the selection set of the main operation.
  const modifiedDoc = visit(document, {
    OperationDefinition: {
      enter(node) {
        return {
          ...node,
          operation: "query",
        };
      },
    },
  });
  return modifiedDoc;
}
