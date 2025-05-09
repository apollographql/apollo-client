import type {
  ASTNode,
  DirectiveNode,
  DocumentNode,
  ExecutableDefinitionNode,
  FieldNode,
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
import {
  isErrorLike,
  LocalResolversError,
  toErrorLike,
} from "@apollo/client/errors";
import type { FetchResult } from "@apollo/client/link";
import type { FragmentMap, IsAny, NoInfer } from "@apollo/client/utilities";
import {
  argumentsObjectFromField,
  buildQueryFromSelectionSet,
  createFragmentMap,
  getFragmentDefinitions,
  getMainDefinition,
  hasDirectives,
  mergeDeep,
  mergeDeepArray,
  resultKeyNameFromField,
  shouldInclude,
  stripTypename,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

interface ExecContext {
  client: ApolloClient;
  operationDefinition: OperationDefinitionNode;
  fragmentMap: FragmentMap;
  context: DefaultContext;
  variables: OperationVariables;
  exportedVariables: OperationVariables;
  onlyRunForcedResolvers: boolean;
  selectionsToResolve: Set<SelectionNode>;
  errors: GraphQLFormattedError[];
  phase: "exports" | "resolve";
  exportedVariableDefs: Record<string, ExportedVariable>;
  rootValue: any;
  diff: Cache.DiffResult<any>;
}

interface ExportedVariable {
  required: boolean;
  field?: FieldNode;
  ancestors: WeakSet<ASTNode>;
}

interface TraverseCacheEntry {
  exportedVariableDefs: Record<string, ExportedVariable>;
  exportsToResolve: Set<SelectionNode>;
  selectionsToResolve: Set<SelectionNode>;
}

type InferRootValueFromFieldResolver<TField> =
  TField extends { [key: string]: infer TResolver } ?
    TResolver extends LocalResolvers.Resolver<any, infer TRootValue, any> ?
      TRootValue
    : unknown
  : unknown;

type InferRootValueFromResolvers<TResolvers> =
  TResolvers extends { Query?: infer QueryResolvers } ?
    InferRootValueFromFieldResolver<QueryResolvers>
  : TResolvers extends { Mutation?: infer MutationResolvers } ?
    InferRootValueFromFieldResolver<MutationResolvers>
  : TResolvers extends { Subscription?: infer SubscriptionResolvers } ?
    InferRootValueFromFieldResolver<SubscriptionResolvers>
  : unknown;

type MaybeRequireRootValue<TRootValue> =
  true extends IsAny<TRootValue> ? {}
  : undefined extends TRootValue ? {}
  : unknown extends TRootValue ? {}
  : {
      rootValue: TRootValue | LocalResolvers.RootValueFunction<TRootValue>;
    };

export declare namespace LocalResolvers {
  // `rootValue` can be any value, but using `any` or `unknown` does not allow
  // the ability to add a function signature to this definition. The generic
  // allows us to provide the function signature while allowing any value.
  export type Options<
    TResolvers extends Resolvers = Resolvers,
    TRootValue = unknown,
  > = {
    /**
     * A value or function called with the request context creating the root
     * value passed to any root field resolvers. Providing a function is useful
     * if you want to use a different root value depending on the operation
     * details.
     *
     * @example
     * ```ts
     * new LocalResolversLink({
     *   rootValue: {
     *     env: "development"
     *   },
     *   resolvers: {
     *     Query: {
     *       rootField: (parent) => {
     *         // parent is { env: "development" }
     *       }
     *     }
     *   }
     * })
     * ```
     */
    rootValue?: TRootValue | RootValueFunction<TRootValue>;

    /**
     * The map of resolvers used to provide values for `@local` fields.
     */
    resolvers?: TResolvers;
  } & MaybeRequireRootValue<TRootValue>;

  export interface RootValueFunctionContext {
    document: DocumentNode;
    client: ApolloClient;
    context: DefaultContext;
    phase: "exports" | "resolve";
    variables: OperationVariables;
  }

  export type RootValueFunction<TRootValue> = (
    context: RootValueFunctionContext
  ) => TRootValue;

  export interface Resolvers {
    [typename: string]: {
      [field: string]: Resolver<any, any, any>;
    };
  }

  export type Resolver<
    TResult = unknown,
    TParent = unknown,
    TArgs = Record<string, unknown>,
  > = (
    rootValue: TParent,
    args: TArgs,
    context: {
      context: DefaultContext;
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

export class LocalResolvers<
  TResolvers extends LocalResolvers.Resolvers = LocalResolvers.Resolvers,
  TRootValue = InferRootValueFromResolvers<TResolvers>,
> {
  private rootValue?: LocalResolvers.Options["rootValue"];
  private resolvers: LocalResolvers.Resolvers = {};
  private traverseCache = new WeakMap<
    ExecutableDefinitionNode,
    TraverseCacheEntry
  >();

  constructor(
    ...[options]: {} extends TResolvers ?
      [options?: LocalResolvers.Options<TResolvers, NoInfer<TRootValue>>]
    : [
        options: LocalResolvers.Options<TResolvers, NoInfer<TRootValue>> & {
          resolvers: TResolvers;
        },
      ]
  ) {
    this.rootValue = options?.rootValue;

    if (options?.resolvers) {
      this.addResolvers(options.resolvers);
    }
  }

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
  }: {
    document: DocumentNode | TypedDocumentNode<TData, TVariables>;
    client: ApolloClient;
    context: DefaultContext;
    remoteResult?: FetchResult<any>;
    variables?: TVariables;
    onlyRunForcedResolvers?: boolean;
  }): Promise<FetchResult<TData>> {
    if (__DEV__) {
      invariant(
        hasDirectives(["client"], document),
        "Expected document to contain `@client` fields."
      );

      validateCacheImplementation(client.cache);
    }

    const mainDefinition = getMainDefinition(
      document
    ) as OperationDefinitionNode;
    const fragments = getFragmentDefinitions(document);
    const fragmentMap = createFragmentMap(fragments);
    const { selectionsToResolve, exportedVariableDefs } =
      this.collectQueryDetail(mainDefinition, fragmentMap);

    const rootValue = remoteResult ? remoteResult.data : {};

    const diff = client.cache.diff<Record<string, any>>({
      query: buildQueryFromSelectionSet(document),
      variables,
      returnPartialData: true,
      optimistic: false,
    });

    const execContext: ExecContext = {
      client,
      operationDefinition: mainDefinition,
      fragmentMap,
      context,
      variables,
      exportedVariables: {},
      selectionsToResolve,
      onlyRunForcedResolvers,
      errors: [],
      phase: "resolve",
      exportedVariableDefs,
      diff,
      rootValue:
        typeof this.rootValue === "function" ?
          this.rootValue({
            document,
            client,
            context,
            phase: "resolve",
            variables: variables ?? {},
          })
        : this.rootValue,
    };

    const localResult = await this.resolveSelectionSet(
      mainDefinition.selectionSet,
      false,
      rootValue,
      execContext,
      []
    );

    const errors = (remoteResult?.errors ?? []).concat(execContext.errors);

    const result: FetchResult<any> = {
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
    context: DefaultContext;
    variables: Partial<NoInfer<TVariables>>;
  }): Promise<TVariables> {
    if (__DEV__) {
      invariant(
        hasDirectives(["client"], document),
        "Expected document to contain `@client` fields."
      );
      validateCacheImplementation(client.cache);
    }
    const mainDefinition = getMainDefinition(
      document
    ) as OperationDefinitionNode;
    const fragments = getFragmentDefinitions(document);
    const fragmentMap = createFragmentMap(fragments);
    const { exportsToResolve, exportedVariableDefs } = this.collectQueryDetail(
      mainDefinition,
      fragmentMap
    );

    const diff = client.cache.diff<Record<string, any>>({
      query: buildQueryFromSelectionSet(document),
      variables,
      returnPartialData: true,
      optimistic: false,
    });

    const execContext: ExecContext = {
      client,
      operationDefinition: mainDefinition,
      fragmentMap,
      context,
      variables,
      exportedVariables: {},
      selectionsToResolve: exportsToResolve,
      onlyRunForcedResolvers: false,
      errors: [],
      phase: "exports",
      exportedVariableDefs,
      diff,
      rootValue:
        typeof this.rootValue === "function" ?
          this.rootValue({
            document,
            client,
            context,
            phase: "resolve",
            variables,
          })
        : this.rootValue,
    };

    await this.resolveSelectionSet(
      mainDefinition.selectionSet,
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
    path: LocalResolvers.Path
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
              rootValue as any,
              execContext,
              selectionSet,
              path.concat(selection.name.value)
            )
          : await this.resolveServerField(
              selection,
              rootValue as any,
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

        let matches = typename === typeCondition;

        if (!matches) {
          matches = cache.fragmentMatches(fragment, typename ?? "");
        }

        if (!matches) {
          throw new LocalResolversError(
            `Fragment '${fragment.name.value}' cannot be used with type '${typename}' as objects of type '${typename}' can never be of type '${fragment.typeCondition.name.value}'.`,
            { path }
          );
        }

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

        return;
      }
    };

    await Promise.all(selectionSet.selections.map(execute));

    return resultsToMerge.length > 0 ? mergeDeepArray(resultsToMerge) : null;
  }

  private resolveServerField(
    field: FieldNode,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: LocalResolvers.Path
  ) {
    const result = rootValue?.[field.name.value];

    if (result == null) {
      if (execContext.phase === "exports") {
        for (const [name, def] of Object.entries(
          execContext.exportedVariableDefs
        )) {
          if (def.ancestors.has(field) && def.required) {
            throw new LocalResolversError(
              `${"Field"} '${field.name.value}' is \`${result}\` which contains exported required variable '${name}'. Ensure this value is in the cache or make the variable optional.`,
              { path }
            );
          }
        }
      }

      return result;
    }

    if (!field.selectionSet) {
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
    path: LocalResolvers.Path
  ): Promise<any> {
    const { client, diff, variables, operationDefinition, phase } = execContext;
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

      return getResultAtPath(diff, path);
    }

    const defaultResolver =
      isClientFieldDescendant ? readField
        // We expect a resolver to be defined for all `@client` root fields.
        // Warn when a resolver is not defined.
      : (
        () => {
          const fieldFromCache = getResultAtPath(diff, path);

          if (fieldFromCache !== undefined) {
            return fieldFromCache;
          }

          if (__DEV__) {
            invariant.warn(
              "Could not find a resolver for the '%s' field. The field value has been set to `null`.",
              resolverName
            );
          }

          return null;
        }
      );

    const resolver = this.getResolver(typename, fieldName);
    let result: unknown;

    try {
      // Avoid running the resolver if we are only trying to run forced
      // resolvers. Fallback to read the value from the root field or the cache
      // value
      if (!execContext.onlyRunForcedResolvers || isForcedResolver(field)) {
        result =
          resolver ?
            await Promise.resolve(
              // In case the resolve function accesses reactive variables,
              // set cacheSlot to the current cache instance.
              cacheSlot.withValue(client.cache, resolver, [
                isRootField ?
                  execContext.rootValue
                : dealias(parentSelectionSet, rootValue),
                (argumentsObjectFromField(field, variables) ?? {}) as Record<
                  string,
                  unknown
                >,
                { context: execContext.context, client, phase },
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
            if (def.required) {
              throw new LocalResolversError(
                `An error was thrown from resolver '${resolverName}' while resolving required variable '${name}'.`,
                { path, sourceError: e }
              );
            }

            if (__DEV__) {
              invariant.error(
                "An error was thrown when resolving the optional exported variable '%s' from resolver '%s':\n[%s]: %s",
                name,
                resolverName,
                isErrorLike(e) ? e.name : "Error",
                isErrorLike(e) ? e.message : ""
              );
            }
          }
        }
      }

      this.addError(toErrorLike(e), path, execContext, {
        resolver: resolverName,
        cause: e,
      });
      return null;
    }

    const resultOrMergeError = (data: unknown) => {
      if (isRootField && rootValue === null) {
        this.addError(
          newInvariantError(
            "Could not merge data from '%s' resolver with remote data since data was `null`.",
            resolverName
          ),
          path,
          execContext,
          { resolver: resolverName, data }
        );

        return null;
      }

      return data;
    };

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
            throw new LocalResolversError(
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

    if (result === undefined) {
      if (__DEV__ && phase === "resolve") {
        if (resolver) {
          invariant.warn(
            "The '%s' resolver returned `undefined` instead of a value. This is likely a bug in the resolver. If you didn't mean to return a value, return `null` instead.",
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

    if (result === null || !field.selectionSet) {
      return resultOrMergeError(result);
    }

    if (Array.isArray(result)) {
      const fieldResult = await this.resolveSubSelectedArray(
        field,
        true,
        result,
        execContext,
        path
      );

      return resultOrMergeError(fieldResult);
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

    const fieldResult = await this.resolveSelectionSet(
      field.selectionSet,
      true,
      result,
      execContext,
      path
    );

    return resultOrMergeError(fieldResult);
  }

  private addError(
    error: ErrorLike,
    path: LocalResolvers.Path,
    execContext: ExecContext,
    meta: { [key: string]: any; resolver: string }
  ) {
    execContext.errors.push(
      addApolloExtension(
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
  ): LocalResolvers.Resolver | undefined {
    return this.resolvers[typename]?.[fieldName];
  }

  private resolveSubSelectedArray(
    field: FieldNode,
    isClientFieldDescendant: boolean,
    result: any[],
    execContext: ExecContext,
    path: LocalResolvers.Path
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
  private collectQueryDetail(
    mainDefinition: OperationDefinitionNode,
    fragmentMap: FragmentMap
  ): TraverseCacheEntry {
    const isSingleASTNode = (
      node: ASTNode | readonly ASTNode[]
    ): node is ASTNode => !Array.isArray(node);
    const fields: Array<{ node: FieldNode; isClientFieldDescendant: boolean }> =
      [];

    function getCurrentPath() {
      return fields.map((field) => field.node.name.value);
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
            const parent = fields.at(-1);

            fields.push({
              node: field,
              isClientFieldDescendant: parent?.isClientFieldDescendant || false,
            });
          },
          leave() {
            fields.pop();
          },
        },
        Directive(node: DirectiveNode, _, __, ___, ancestors) {
          const fieldInfo = fields.at(-1);

          if (
            node.name.value === "export" &&
            // Ignore export directives that aren't inside client fields.
            // These will get sent to the server
            fieldInfo?.isClientFieldDescendant
          ) {
            const fieldName = fieldInfo?.node.name.value;
            const variableName = getExportedVariableName(node);

            if (!variableName) {
              throw new LocalResolversError(
                `Cannot determine the variable name from the \`@export\` directive used on field '${fieldName}'. Perhaps you forgot the \`as\` argument?`,
                { path: getCurrentPath() }
              );
            }

            if (!allVariableDefinitions[variableName]) {
              throw new LocalResolversError(
                `\`@export\` directive on field '${fieldName}' does not have an associated variable definition for the '${variableName}' variable.`,
                { path: getCurrentPath() }
              );
            }

            cache.exportedVariableDefs[variableName] = {
              ...allVariableDefinitions[variableName],
              field: fieldInfo.node,
            };

            ancestors.forEach((node) => {
              if (isSingleASTNode(node) && isSelectionNode(node)) {
                cache.exportsToResolve.add(node);
                cache.exportedVariableDefs[variableName].ancestors.add(node);
              }
            });
          }

          if (node.name.value === "client") {
            if (fieldInfo) {
              fieldInfo.isClientFieldDescendant = true;
            }

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

    return traverse(mainDefinition);
  }
}

function inferRootTypename({ operation }: OperationDefinitionNode) {
  return operation.charAt(0).toUpperCase() + operation.slice(1);
}

// Note: this is a shallow dealias function. We might consider a future
// improvement of dealiasing all nested data. Until that need arises, we can
// keep this simple.
function dealias(
  selectionSet: SelectionSetNode,
  fieldValue: Record<string, any> | null | undefined
) {
  if (!fieldValue) {
    return fieldValue;
  }

  const data = { ...fieldValue };

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD && selection.alias) {
      data[selection.name.value] = fieldValue[selection.alias.value];
      delete data[selection.alias.value];
    }
  }

  return data;
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

function addApolloExtension(
  error: GraphQLFormattedError,
  meta: Record<string, any>
) {
  return {
    ...error,
    extensions: {
      ...error.extensions,
      apollo: { source: "LocalResolvers", ...meta },
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

function getResultAtPath(
  diff: Cache.DiffResult<any>,
  path: LocalResolvers.Path
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
