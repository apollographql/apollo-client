import type {
  ASTNode,
  DirectiveNode,
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
import { defer, from, mergeMap, of } from "rxjs";

import type { ErrorLike, OperationVariables } from "@apollo/client";
import { cacheSlot } from "@apollo/client/cache";
import { LocalResolversError, toErrorLike } from "@apollo/client/errors";
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
    phase: "exports" | "resolve";
  }
}

type ExecContext = {
  operation: Operation;
  operationDefinition: OperationDefinitionNode;
  fragmentMap: FragmentMap;
  selectionsToResolve: Set<SelectionNode>;
  errors: GraphQLFormattedError[];
  errorMeta?: Record<string, any>;
  exportedVariableDefs: Record<string, ExportedVariable>;
} & (
  | {
      exportedVariables: OperationVariables;
      phase: "exports";
    }
  | {
      phase: "resolve";
    }
);

type Path = Array<string | number>;

interface ExportedVariable {
  required: boolean;
  usedInServerField: boolean;
}

interface TraverseCacheEntry {
  selectionsToResolve: Set<SelectionNode>;
  exportsToResolve: Set<SelectionNode>;
  exportedVariableDefs: { [variableName: string]: ExportedVariable };
}

export class LocalResolversLink extends ApolloLink {
  private traverseCache = new WeakMap<
    ExecutableDefinitionNode,
    TraverseCacheEntry
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

    return defer(() => {
      const mainDefinition = getMainDefinition(
        clientQuery
      ) as OperationDefinitionNode;
      const fragments = getFragmentDefinitions(clientQuery);
      const fragmentMap = createFragmentMap(fragments);

      const { selectionsToResolve, exportsToResolve, exportedVariableDefs } =
        this.traverseAndCollectQueryInfo(mainDefinition, fragmentMap);

      const execContext = {
        operation,
        operationDefinition: mainDefinition,
        fragmentMap,
        errors: [],
        exportedVariableDefs,
      } satisfies Partial<ExecContext>;

      return from(
        this.addExportedVariables({
          ...execContext,
          selectionsToResolve: exportsToResolve,
          exportedVariables: {},
          phase: "exports",
        })
      ).pipe(
        mergeMap(getServerResult),
        mergeMap((result) => {
          return from(
            this.runResolvers({
              remoteResult: result,
              execContext: {
                ...execContext,
                selectionsToResolve,
                phase: "resolve",
              },
            })
          );
        })
      );
    });
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
    const { fragmentMap, operation, operationDefinition } = execContext;
    const { client, variables } = operation;
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

  private executeResolver(
    resolver: LocalResolversLink.Resolver,
    rootValue: Record<string, any>,
    info: Parameters<LocalResolversLink.Resolver>[3],
    execContext: ExecContext
  ) {
    const { operation, phase } = execContext;

    return Promise.resolve(
      cacheSlot.withValue(operation.client.cache, resolver, [
        rootValue,
        argumentsObjectFromField(info.field, operation.variables),
        { phase, operation },
        info,
      ])
    );
  }

  private async resolveRootField(
    field: FieldNode,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: Path
  ) {
    const { operationDefinition } = execContext;
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
          if (__DEV__) {
            invariant.warn(
              "Could not find a resolver for the '%s' field. The field value has been set to `null`.",
              resolverName
            );
          }

          return null;
        }
      : () => rootValue?.[fieldName] ?? null;

    const resolver = this.resolvers[typename]?.[fieldName];

    try {
      let result =
        resolver ?
          await this.executeResolver(
            resolver,
            // TODO: Add support for a `rootValue` option to `LocalResolversLink`
            {},
            { field, fragmentMap: execContext.fragmentMap, path },
            execContext
          )
        : defaultResolver();

      if (result === undefined) {
        if (__DEV__) {
          invariant.warn(
            "The '%s' resolver returned `undefined` instead of a value. This is likely a bug in the resolver. If you didn't mean to return a value, return `null` instead.",
            resolverName
          );
        }
        result = null;
      }

      this.addExports(field, result, execContext);

      // Handle all scalar types here.
      if (!field.selectionSet) {
        if (execContext.phase === "resolve") {
          execContext.errorMeta = { data: result };
          invariant(
            rootValue !== null,
            "Could not merge data from '%s' resolver with remote data since data was `null`.",
            resolverName
          );
        }

        return result;
      }

      // From here down, the field has a selection set, which means it's trying
      // to query a GraphQLObjectType.
      if (result == null) {
        // Basically any field in a GraphQL response can be null, or missing
        return result;
      }

      if (Array.isArray(result)) {
        const fieldResult = await this.resolveSubSelectedArray(
          field,
          isClientField,
          result,
          execContext,
          path
        );

        if (execContext.phase === "resolve") {
          execContext.errorMeta = { data: fieldResult };
          invariant(
            rootValue !== null,
            "Could not merge data from '%s' resolver with remote data since data was `null`.",
            resolverName
          );
        }
        return fieldResult;
      }

      if (execContext.phase === "resolve") {
        invariant(
          result.__typename,
          "Could not resolve __typename on object %o returned from resolver '%s'. This is an error and will cause issues when writing to the cache.",
          result,
          resolverName
        );
      }

      const fieldResult = await this.resolveSelectionSet(
        field.selectionSet,
        isClientField,
        result,
        execContext,
        path
      );

      if (execContext.phase === "resolve") {
        execContext.errorMeta = { data: fieldResult };
        invariant(
          rootValue !== null,
          "Could not merge data from '%s' resolver with remote data since data was `null`.",
          resolverName
        );
      }

      return fieldResult;
    } catch (e) {
      if (__DEV__ && execContext.phase === "exports") {
        forEachExportedVariable(field, execContext, (name, info) => {
          if (info.required) {
            throw new LocalResolversError(
              `An error was thrown when resolving required exported variable '${name}' from resolver '${resolverName}'.`,
              { path, sourceError: e }
            );
          } else {
            invariant.error(
              "An error was thrown when resolving the optional exported variable '%s' from resolver '%s'.",
              name,
              resolverName
            );
          }
        });
      }
      this.addError(toErrorLike(e), path, execContext, {
        resolver: resolverName,
        phase: execContext.phase,
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
          if (__DEV__) {
            invariant.warn(
              "Could not find a resolver for the '%s' field. The field value has been set to `null`.",
              resolverName
            );
          }

          return null;
        }
      : () => rootValue[fieldName];

    const resolver = this.resolvers[typename]?.[fieldName];

    try {
      let result =
        resolver ?
          await this.executeResolver(
            resolver,
            dealias(parentSelectionSet, rootValue),
            { field, fragmentMap: execContext.fragmentMap, path },
            execContext
          )
        : defaultResolver();

      if (result === undefined) {
        if (__DEV__) {
          invariant.warn(
            isClientFieldDescendant ?
              "The '%s' field returned `undefined` instead of a value. This is either because the parent resolver forgot to include the property in the returned value, a resolver is not defined for the field, or the resolver returned `undefined`."
            : "The '%s' resolver returned `undefined` instead of a value. This is likely a bug in the resolver. If you didn't mean to return a value, return `null` instead.",
            resolverName
          );
        }
        result = null;
      }

      this.addExports(field, result, execContext);

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

      if (execContext.phase === "resolve") {
        invariant(
          result.__typename,
          "Could not resolve __typename on object %o returned from resolver '%s'. This is an error and will cause issues when writing to the cache.",
          result,
          resolverName
        );
      }

      return this.resolveSelectionSet(
        field.selectionSet,
        isClientFieldDescendant || isClientField,
        result,
        execContext,
        path
      );
    } catch (e) {
      forEachExportedVariable(field, execContext, (name, info) => {
        if (info.required) {
          throw new LocalResolversError(
            `An error was thrown when resolving required exported variable '${name}' from resolver '${resolverName}'.`,
            { path, sourceError: e }
          );
        } else {
          invariant.error(
            "An error was thrown when resolving the optional exported variable '%s' from resolver '%s'.",
            name,
            resolverName
          );
        }
      });
      this.addError(toErrorLike(e), path, execContext, {
        resolver: resolverName,
        phase: execContext.phase,
      });

      return null;
    }
  }

  private addExports(
    field: FieldNode,
    result: unknown,
    execContext: ExecContext
  ) {
    const { phase } = execContext;

    if (phase === "exports") {
      forEachExportedVariable(field, execContext, (name) => {
        execContext.exportedVariables[name] = result;
      });
    }
  }

  private addError(
    error: ErrorLike,
    path: Path,
    execContext: ExecContext,
    meta: { resolver: string; phase: "exports" | "resolve" }
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
    const isSingleASTNode = (
      node: ASTNode | readonly ASTNode[]
    ): node is ASTNode => !Array.isArray(node);
    let fieldDepth = 0;
    const fields: Array<{
      name: string;
      isRoot: boolean;
      isClientFieldOrDescendent: boolean;
      hasClientRoot: boolean;
    }> = [];

    function getCurrentPath() {
      return fields.map((field) => field.name);
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
        selectionsToResolve: new Set<SelectionNode>(),
        exportsToResolve: new Set<SelectionNode>(),
        exportedVariableDefs: {},
      };
      this.traverseCache.set(definitionNode, cache);

      visit(definitionNode, {
        VariableDefinition: (definition) => {
          allVariableDefinitions[definition.variable.name.value] = {
            required: definition.type.kind === Kind.NON_NULL_TYPE,
            usedInServerField: false,
          };
        },
        Field: {
          enter(field) {
            const parent = fields.at(-1);

            fields.push({
              name: field.name.value,
              isRoot: fieldDepth++ === 0,
              isClientFieldOrDescendent:
                parent?.isClientFieldOrDescendent ?? false,
              hasClientRoot:
                parent?.hasClientRoot ||
                (parent?.isRoot && parent?.isClientFieldOrDescendent) ||
                false,
            });
          },
          leave(field) {
            fieldDepth--;
            const fieldInfo = fields.pop();

            field.arguments?.forEach((arg) => {
              if (arg.value.kind === Kind.VARIABLE) {
                const variableDef =
                  allVariableDefinitions[arg.value.name.value];

                if (variableDef) {
                  variableDef.usedInServerField ||=
                    !fieldInfo?.isClientFieldOrDescendent;
                }
              }
            });
          },
        },
        Directive: (directive, _, __, ___, ancestors) => {
          const fieldInfo = fields.at(-1);

          if (
            directive.name.value === "export" &&
            // Ignore export directives that aren't inside client fields.
            // These will get sent to the server
            fieldInfo?.isClientFieldOrDescendent
          ) {
            if (!fieldInfo.hasClientRoot) {
              throw new LocalResolversError(
                "Cannot export a variable from a field that is a child of a remote field. Exported variables must either originate from a root-level client field or a child of a root-level client field.",
                { path: getCurrentPath() }
              );
            }

            const variableName = getExportedVariableName(directive);

            if (!variableName) {
              throw new LocalResolversError(
                `Cannot determine the variable name from the \`@export\` directive used on field '${fieldInfo.name}'. Perhaps you forgot the \`as\` argument?`,
                { path: getCurrentPath() }
              );
            }

            if (!allVariableDefinitions[variableName]) {
              throw new LocalResolversError(
                `\`@export\` directive on field '${fieldInfo.name}' does not have an associated variable definition for the '${variableName}' variable.`,
                { path: getCurrentPath() }
              );
            }

            cache.exportedVariableDefs[variableName] =
              allVariableDefinitions[variableName];

            ancestors.forEach((node) => {
              if (isSingleASTNode(node) && isSelectionNode(node)) {
                cache.exportsToResolve.add(node);
              }
            });
          }

          if (directive.name.value === "client") {
            if (fieldInfo) {
              fieldInfo.isClientFieldOrDescendent = true;
              fieldInfo.hasClientRoot ||= fieldInfo.isRoot;
            }

            ancestors.forEach((node) => {
              if (isSingleASTNode(node) && isSelectionNode(node)) {
                cache.selectionsToResolve.add(node);
              }
            });
          }
        },
        FragmentSpread: (spread, _, __, ___, ancestors) => {
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

function getExportedVariableName(directive: DirectiveNode) {
  if (directive.arguments) {
    for (const arg of directive.arguments) {
      if (arg.name.value === "as" && arg.value.kind === Kind.STRING) {
        return arg.value.value;
      }
    }
  }
}

function forEachExportedVariable(
  field: FieldNode,
  execContext: ExecContext,
  fn: (name: string, exportedVariable: ExportedVariable) => void
) {
  if (field.directives) {
    field.directives.forEach((directive) => {
      if (directive.name.value === "export") {
        const name = getExportedVariableName(directive);

        if (name) {
          fn(name, execContext.exportedVariableDefs[name]);
        }
      }
    });
  }
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
