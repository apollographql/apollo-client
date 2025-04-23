import type {
  ASTNode,
  DocumentNode,
  ExecutableDefinitionNode,
  FieldNode,
  GraphQLError,
  GraphQLFormattedError,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from "graphql";
import { isSelectionNode, Kind, visit } from "graphql";
import { wrap } from "optimism";
import type { Observable } from "rxjs";
import { from, mergeMap, of } from "rxjs";

import type { ErrorLike, OperationVariables } from "@apollo/client";
import { cacheSlot } from "@apollo/client/cache";
import { toErrorLike } from "@apollo/client/errors";
import type {
  FetchResult,
  NextLink,
  Operation,
} from "@apollo/client/link/core";
import { ApolloLink } from "@apollo/client/link/core";
import type { FragmentMap } from "@apollo/client/utilities";
import {
  argumentsObjectFromField,
  cacheSizes,
  createFragmentMap,
  getFragmentDefinitions,
  getMainDefinition,
  hasDirectives,
  isField,
  mergeDeep,
  mergeDeepArray,
  removeDirectivesFromDocument,
  resultKeyNameFromField,
  shouldInclude,
  stripTypename,
  tap,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

import { defaultCacheSizes } from "../../utilities/caching/sizes.js";

export declare namespace LocalResolversLink {
  export interface Options {
    resolvers?: Resolvers;
  }

  export interface Resolvers {
    [typename: string]: {
      [field: string]: Resolver;
    };
  }

  export type Resolver = (
    rootValue: any,
    args: any,
    context: ResolverContext,
    info: {
      field: FieldNode;
      fragmentMap: FragmentMap;
      path: Path;
    }
  ) => any;

  export interface ResolverContext {
    operation: Operation;
  }
}

type ExecContext =
  | {
      operation: Operation;
      operationDefinition: OperationDefinitionNode;
      fragmentMap: FragmentMap;
      exportsToResolve: Set<SelectionNode>;
      errors: GraphQLFormattedError[];
      exportedVariables?: OperationVariables;
      errorMeta?: Record<string, any>;
      phase: "exports";
    }
  | {
      operation: Operation;
      operationDefinition: OperationDefinitionNode;
      fragmentMap: FragmentMap;
      selectionsToResolve: Set<SelectionNode>;
      errors: GraphQLFormattedError[];
      errorMeta?: Record<string, any>;
      exportedVariables?: OperationVariables;
      phase: "resolve";
    };

type Path = Array<string | number>;

export class LocalResolversLink extends ApolloLink {
  private selectionsToResolveCache = new WeakMap<
    ExecutableDefinitionNode,
    Set<SelectionNode>
  >();
  private selectionsWithExportsCache = new WeakMap<
    ExecutableDefinitionNode,
    Set<SelectionNode>
  >();
  private resolvers: LocalResolversLink.Resolvers = {};

  constructor(options: LocalResolversLink.Options = {}) {
    super();

    if (options.resolvers) {
      this.addResolvers(options.resolvers);
    }
  }

  addResolvers(resolvers: LocalResolversLink.Resolvers) {
    this.resolvers = mergeDeep(this.resolvers, resolvers);
  }

  override request(
    operation: Operation,
    forward?: NextLink
  ): Observable<FetchResult> {
    const { clientQuery, serverQuery } = getTransformedQuery(operation.query);

    if (!clientQuery) {
      return getServerResult(operation.variables);
    }

    function getServerResult(variables: OperationVariables) {
      // Modify `variables` early to ensure they are available to other client
      // resolvers when there is not a server query.
      operation.variables = variables;

      if (!serverQuery) {
        // If we don't have a server query, then we have a client-only query.
        // Intentionally use `{}` here as the value to ensure that client-only
        // fields are merged into the final result. If this were `null`, then
        // the client fields would add errors to the error array and return
        // `data` of `null`.
        return of({ data: {} });
      }

      invariant(
        !!forward,
        "`LocalResolversLink` must not be a terminating link when there are non-`@client` fields in the query"
      );

      operation.query = serverQuery;

      return forward(operation);
    }

    const mainDefinition = getMainDefinition(
      clientQuery
    ) as OperationDefinitionNode;
    const fragments = getFragmentDefinitions(clientQuery);
    const fragmentMap = createFragmentMap(fragments);

    this.traverseAndCollectQueryInfo(mainDefinition, fragmentMap);

    const execContext = {
      operation,
      operationDefinition: mainDefinition,
      fragmentMap,
      errors: [],
    } satisfies Partial<ExecContext>;

    return from(
      this.addExportedVariables({
        ...execContext,
        exportsToResolve: this.selectionsWithExportsCache.get(mainDefinition)!,
        phase: "exports",
        exportedVariables: {},
      })
    ).pipe(
      mergeMap(getServerResult),
      mergeMap((result) => {
        return from(
          this.runResolvers({
            remoteResult: result,
            execContext: {
              ...execContext,
              selectionsToResolve:
                this.selectionsToResolveCache.get(mainDefinition)!,
              phase: "resolve",
              errors: [],
            },
          })
        );
      })
    );
  }

  private async addExportedVariables(
    execContext: ExecContext & { phase: "exports" }
  ) {
    const { variables } = execContext.operation;

    await this.resolveSelectionSet(
      execContext.operationDefinition.selectionSet,
      false,
      {},
      execContext,
      []
    );

    return {
      ...variables,
      ...stripTypename(execContext.exportedVariables),
    };
  }

  private async runResolvers({
    remoteResult,
    execContext,
  }: {
    remoteResult: FetchResult;
    execContext: ExecContext & { phase: "resolve" };
  }): Promise<FetchResult> {
    const localResult = await this.resolveSelectionSet(
      execContext.operationDefinition.selectionSet,
      false,
      remoteResult.data,
      execContext,
      []
    );

    const errors = (remoteResult.errors ?? []).concat(execContext.errors);

    const result = {
      ...remoteResult,
      data: mergeDeep(remoteResult.data, localResult),
    };

    if (errors.length > 0) {
      result.errors = errors;
    }

    return result;
  }

  private async resolveSelectionSet(
    selectionSet: SelectionSetNode,
    isClientFieldDescendant: boolean,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: Path
  ) {
    const { fragmentMap, operation, operationDefinition, phase } = execContext;
    const { client, variables } = operation;
    const resultsToMerge: Array<Record<string, any>> = [];

    const execute = async (selection: SelectionNode): Promise<void> => {
      const shouldResolve =
        phase === "exports" ?
          execContext.exportsToResolve.has(selection)
        : execContext.selectionsToResolve.has(selection);
      if (!isClientFieldDescendant && !shouldResolve) {
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

        const fieldResult =
          isRootField ?
            await this.resolveRootField(
              selection,
              rootValue,
              execContext,
              path.concat(selection.name.value)
            )
          : await this.resolveChildField(
              selection,
              isClientFieldDescendant,
              rootValue,
              execContext,
              selectionSet,
              path.concat(selection.name.value)
            );

        if (fieldResult !== undefined && (!isRootField || rootValue !== null)) {
          resultsToMerge.push({
            [resultKeyNameFromField(selection)]: fieldResult,
          });
        }

        return;
      }

      if (selection.kind === Kind.INLINE_FRAGMENT) {
        if (
          selection.typeCondition &&
          rootValue?.__typename &&
          // TODO: Warn if fragmentMatches is undefined
          client.cache.fragmentMatches?.(selection, rootValue.__typename)
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
      }

      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragment = fragmentMap[selection.name.value];
        invariant(fragment, `No fragment named %s`, selection.name.value);

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

  private async resolveRootField(
    field: FieldNode,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: Path
  ) {
    const { exportedVariables, operationDefinition, operation } = execContext;
    const isClientField =
      field.directives?.some((d) => d.name.value === "client") ?? false;

    // If the root field contains a selection with `@client` field, but the
    // server result did not return a value, we can short-circuit this execution
    // to avoid calling child resolvers unnecessarily.
    if (!rootValue && !isClientField) {
      return rootValue;
    }

    const typename =
      rootValue?.__typename || inferRootTypename(operationDefinition);
    const fieldName = field.name.value;
    const resolverName = getResolverName(typename, fieldName);

    const defaultResolver =
      // We expect a resolver to be defined for all root-level `@client` fields
      // so we warn if a resolver is not defined.
      isClientField ?
        () => {
          invariant.warn(
            "Could not find a resolver for the '%s' field. The field value has been set to `null`.",
            resolverName
          );

          return null;
        }
      : () => rootValue?.[fieldName] ?? null;

    const resolver = this.resolvers[typename]?.[fieldName];

    try {
      let result =
        resolver ?
          await Promise.resolve(
            // In case the resolve function accesses reactive variables,
            // set cacheSlot to the current cache instance.
            cacheSlot.withValue(operation.client.cache, resolver, [
              // TODO: Add a `rootField` option to `LocalResolversLink`
              {},
              argumentsObjectFromField(field, operation.variables),
              { operation },
              { field, fragmentMap: execContext.fragmentMap, path },
            ])
          )
        : defaultResolver();

      if (result === undefined) {
        invariant.warn(
          "The '%s' resolver returned `undefined` instead of a value. This is likely a bug in the resolver. If you didn't mean to return a value, return `null` instead.",
          resolverName
        );
        result = null;
      }

      if (exportedVariables && field.directives) {
        field.directives.forEach((directive) => {
          if (directive.name.value === "export" && directive.arguments) {
            directive.arguments.forEach((arg) => {
              if (arg.name.value === "as" && arg.value.kind === Kind.STRING) {
                exportedVariables[arg.value.value] = result;
              }
            });
          }
        });
      }

      // Handle all scalar types here.
      if (!field.selectionSet) {
        return tap(result, () => {
          execContext.errorMeta = { data: result };
          invariant(
            rootValue !== null,
            "Could not merge data from '%s' resolver with remote data since data was `null`.",
            resolverName
          );
        });
      }

      // From here down, the field has a selection set, which means it's trying
      // to query a GraphQLObjectType.
      if (result == null) {
        // Basically any field in a GraphQL response can be null, or missing
        return result;
      }

      if (Array.isArray(result)) {
        return tap(
          await this.resolveSubSelectedArray(
            field,
            isClientField,
            result,
            execContext,
            path
          ),
          (fieldResult) => {
            execContext.errorMeta = { data: fieldResult };
            invariant(
              rootValue !== null,
              "Could not merge data from '%s' resolver with remote data since data was `null`.",
              resolverName
            );
          }
        );
      }

      // Returned value is an object, and the query has a sub-selection. Recurse.
      if (field.selectionSet) {
        invariant(
          result.__typename,
          "Could not resolve __typename on object %o returned from resolver '%s'. This is an error and will cause issues when writing to the cache.",
          result,
          resolverName
        );

        return tap(
          await this.resolveSelectionSet(
            field.selectionSet,
            isClientField,
            result,
            execContext,
            path
          ),
          (fieldResult) => {
            execContext.errorMeta = { data: fieldResult };
            invariant(
              rootValue !== null,
              "Could not merge data from '%s' resolver with remote data since data was `null`.",
              resolverName
            );
          }
        );
      }
    } catch (e) {
      this.addError(toErrorLike(e), path, execContext, {
        resolver: resolverName,
      });

      return null;
    }
  }

  private async resolveChildField(
    field: FieldNode,
    isClientFieldDescendant: boolean,
    rootValue: any,
    execContext: ExecContext,
    parentSelectionSet: SelectionSetNode,
    path: Path
  ) {
    if (!rootValue) {
      return null;
    }

    const { operation, exportedVariables } = execContext;
    const { variables } = operation;
    const fieldName = field.name.value;
    const isClientField =
      field.directives?.some((d) => d.name.value === "client") ?? false;
    const typename = rootValue.__typename;
    const resolverName = getResolverName(typename, fieldName);

    const defaultResolver =
      // We expect a resolver to be defined for all top-level `@client` fields
      // so we warn if a resolver is not defined.
      isClientField && !isClientFieldDescendant ?
        () => {
          invariant.warn(
            "Could not find a resolver for the '%s' field. The field value has been set to `null`.",
            resolverName
          );

          return null;
        }
      : () => rootValue[fieldName];

    const resolver = this.resolvers[typename]?.[fieldName];

    try {
      let result =
        resolver ?
          await Promise.resolve(
            // In case the resolve function accesses reactive variables,
            // set cacheSlot to the current cache instance.
            cacheSlot.withValue(operation.client.cache, resolver, [
              // Ensure the parent value passed to the resolver does not contain
              // aliased fields, otherwise it is nearly impossible to determine
              // what property in the parent type contains the field you want to
              // read from. `dealias` contains a shallow copy of `rootValue`
              dealias(parentSelectionSet, rootValue),
              argumentsObjectFromField(field, variables),
              { operation },
              { field, fragmentMap: execContext.fragmentMap, path },
            ])
          )
        : defaultResolver();

      if (result === undefined) {
        invariant.warn(
          isClientFieldDescendant ?
            "The '%s' field returned `undefined` instead of a value. This is either because the parent resolver forgot to include the property in the returned value, a resolver is not defined for the field, or the resolver returned `undefined`."
          : "The '%s' resolver returned `undefined` instead of a value. This is likely a bug in the resolver. If you didn't mean to return a value, return `null` instead.",
          resolverName
        );
        result = null;
      }

      if (exportedVariables && field.directives) {
        field.directives.forEach((directive) => {
          if (directive.name.value === "export" && directive.arguments) {
            directive.arguments.forEach((arg) => {
              if (arg.name.value === "as" && arg.value.kind === Kind.STRING) {
                exportedVariables[arg.value.value] = result;
              }
            });
          }
        });
      }

      // Handle all scalar types here.
      if (!field.selectionSet) {
        return result;
      }

      // From here down, the field has a selection set, which means it's trying
      // to query a GraphQLObjectType.
      if (result == null) {
        // Basically any field in a GraphQL response can be null, or missing
        return result;
      }
      if (Array.isArray(result)) {
        return this.resolveSubSelectedArray(
          field,
          isClientFieldDescendant || isClientField,
          result,
          execContext,
          path
        );
      }

      // Returned value is an object, and the query has a sub-selection. Recurse.
      if (field.selectionSet) {
        invariant(
          result.__typename,
          "Could not resolve __typename on object %o returned from resolver '%s'. This is an error and will cause issues when writing to the cache.",
          result,
          resolverName
        );

        return this.resolveSelectionSet(
          field.selectionSet,
          isClientFieldDescendant || isClientField,
          result,
          execContext,
          path
        );
      }
    } catch (e) {
      this.addError(toErrorLike(e), path, execContext, {
        resolver: resolverName,
      });

      return null;
    }
  }

  private addError(
    error: ErrorLike,
    path: Path,
    execContext: ExecContext,
    meta: { resolver: string }
  ) {
    execContext.errors.push(
      addApolloExtension(
        isGraphQLError(error) ?
          { ...error.toJSON(), path }
        : { message: error.message, path },
        { ...execContext.errorMeta, ...meta }
      )
    );
  }

  private resolveSubSelectedArray(
    field: FieldNode,
    isClientFieldDescendant: boolean,
    result: any[],
    execContext: ExecContext,
    path: Path
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
  private traverseAndCollectQueryInfo(
    mainDefinition: OperationDefinitionNode,
    fragmentMap: FragmentMap
  ) {
    const clientDescendantStack: boolean[] = [];
    const isSingleASTNode = (
      node: ASTNode | readonly ASTNode[]
    ): node is ASTNode => !Array.isArray(node);

    const traverseDefinition = (
      definitionNode: ExecutableDefinitionNode
    ): Set<SelectionNode> => {
      if (!this.selectionsToResolveCache.has(definitionNode)) {
        const clientMatches = new Set<SelectionNode>();
        const exportMatches = new Set<SelectionNode>();
        this.selectionsToResolveCache.set(definitionNode, clientMatches);
        this.selectionsWithExportsCache.set(definitionNode, exportMatches);

        visit(definitionNode, {
          Field: {
            enter() {
              // We determine if a field is a descendant of a client field by
              // pushing booleans onto this stack. The `Directive` visitor is
              // responsible for changing this value to `true` if an `@client`
              // fiels is detected. We determine if we are a descendant of a
              // client field by pushing the value from the last field, which
              // should be `true` if an `@client` field was detected. Once
              // leaving the field, we pop the value off the stack.
              //
              // This approach has one downside in that it is order dependent.
              // `@client` must come before `@export` in order for this to
              // detect properly, otherwise the `@export` field is ignored.
              clientDescendantStack.push(clientDescendantStack.at(-1) || false);
            },
            leave() {
              clientDescendantStack.pop();
            },
          },
          Directive: (node, _, __, ___, ancestors) => {
            if (node.name.value === "export" && clientDescendantStack.at(-1)) {
              ancestors.forEach((node) => {
                if (isSingleASTNode(node) && isSelectionNode(node)) {
                  exportMatches.add(node);
                }
              });
            }

            if (node.name.value === "client") {
              clientDescendantStack[clientDescendantStack.length - 1] = true;
              ancestors.forEach((node) => {
                if (isSingleASTNode(node) && isSelectionNode(node)) {
                  clientMatches.add(node);
                }
              });
            }
          },
          FragmentSpread: (spread, _, __, ___, ancestors) => {
            const fragment = fragmentMap[spread.name.value];
            invariant(fragment, `No fragment named %s`, spread.name.value);

            const fragmentSelections = traverseDefinition(fragment);
            if (fragmentSelections.size > 0) {
              // Fragment for this spread contains @client directive (either directly or transitively)
              // Collect selection nodes on paths from the root down to fields with the @client directive
              ancestors.forEach((node) => {
                if (isSingleASTNode(node) && isSelectionNode(node)) {
                  clientMatches.add(node);
                }
              });
              clientMatches.add(spread);
              fragmentSelections.forEach((selection) => {
                clientMatches.add(selection);
              });
            }
          },
        });
      }
      return this.selectionsToResolveCache.get(definitionNode)!;
    };

    traverseDefinition(mainDefinition);
  }
}

// Note: this is a shallow dealias function. We might consider a future
// improvement of dealiasing all nested data. Until that need arises, we can
// keep this simple.
function dealias(
  selectionSet: SelectionSetNode,
  fieldValue: Record<string, any>
) {
  const data = { ...fieldValue };

  for (const selection of selectionSet.selections) {
    if (isField(selection) && selection.alias) {
      data[selection.name.value] = data[selection.alias.value];
      delete data[selection.alias.value];
    }
  }

  return data;
}

const getTransformedQuery = wrap(
  (query: DocumentNode) => {
    return {
      clientQuery: hasDirectives(["client"], query) ? query : null,
      serverQuery: removeDirectivesFromDocument(
        [{ name: "client", remove: true }],
        query
      ),
    };
  },
  {
    max:
      cacheSizes["LocalResolversLink.getTransformedQuery"] ||
      defaultCacheSizes["LocalResolversLink.getTransformedQuery"],
  }
);

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
  meta: { resolver: string }
) {
  return {
    ...error,
    extensions: {
      ...error.extensions,
      apollo: { source: "LocalResolversLink", ...meta },
    },
  };
}

function inferRootTypename({ operation }: OperationDefinitionNode) {
  return operation.charAt(0).toUpperCase() + operation.slice(1);
}

function getResolverName(typename: string, fieldName: string) {
  return `${typename}.${fieldName}`;
}

if (__DEV__) {
  Object.assign(LocalResolversLink, {
    getMemoryInternals() {
      return {
        LocalResolversLink: {
          getTransformedQuery: getTransformedQuery.size,
        },
      };
    },
  });
}
