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
  hasClientExports,
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
  }
}

type ExecContext = {
  operation: Operation;
  operationDefinition: OperationDefinitionNode;
  fragmentMap: FragmentMap;
  selectionsToResolve: Set<SelectionNode>;
  errors: GraphQLFormattedError[];
  exportedVariables?: OperationVariables;
};

type Path = Array<string | number>;

export class LocalResolversLink extends ApolloLink {
  private selectionsToResolveCache = new WeakMap<
    ExecutableDefinitionNode,
    Set<SelectionNode>
  >();
  private definitionsWithExportsCache = new WeakSet<OperationDefinitionNode>();
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
        return of({ data: null });
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
    const selectionsToResolve = this.collectDefinitionInfo(
      mainDefinition,
      fragmentMap
    );

    const execContext: ExecContext = {
      operation,
      operationDefinition: mainDefinition,
      fragmentMap,
      selectionsToResolve,
      errors: [],
    };

    return from(
      this.addExportedVariables({
        ...execContext,
        exportedVariables: {},
      })
    ).pipe(
      mergeMap(getServerResult),
      mergeMap((result) => {
        return from(
          this.runResolvers({
            remoteResult: result,
            execContext: { ...execContext, errors: [] },
          })
        );
      })
    );
  }

  private async addExportedVariables(execContext: ExecContext) {
    const { variables } = execContext.operation;

    if (
      !this.definitionsWithExportsCache.has(execContext.operationDefinition)
    ) {
      return variables;
    }

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
    execContext: ExecContext;
  }): Promise<FetchResult> {
    const localResult = await this.resolveSelectionSet(
      execContext.operationDefinition.selectionSet,
      false,
      remoteResult.data ?? {},
      execContext,
      []
    );

    let errors = execContext.errors;

    if (remoteResult.errors) {
      errors = remoteResult.errors.concat(errors);
    }

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
    const { fragmentMap, operation } = execContext;
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
        const fieldResult = await this.resolveField(
          selection,
          isClientFieldDescendant,
          rootValue,
          execContext,
          selectionSet,
          path.concat(selection.name.value)
        );

        if (fieldResult !== undefined) {
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

          resultsToMerge.push(fragmentResult);

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

        resultsToMerge.push(fragmentResult);

        return;
      }
    };

    await Promise.all(selectionSet.selections.map(execute));

    return mergeDeepArray(resultsToMerge);
  }

  private async resolveField(
    field: FieldNode,
    isClientFieldDescendant: boolean,
    rootValue: any,
    execContext: ExecContext,
    parentSelectionSet: SelectionSetNode,
    path: Path
  ): Promise<any> {
    if (!rootValue) {
      return null;
    }

    const { operation, operationDefinition, exportedVariables } = execContext;
    const { variables } = operation;
    const fieldName = field.name.value;

    const isClientField =
      field.directives?.some((d) => d.name.value === "client") ?? false;
    const isRootField = parentSelectionSet === operationDefinition.selectionSet;
    const rootTypename =
      isRootField ? getRootTypename(operationDefinition) : undefined;
    const typename = rootValue.__typename || rootTypename;

    const defaultResolver =
      isClientField && !isClientFieldDescendant ?
        () => {
          invariant.warn(
            "Could not find a resolver for the '%s' field. The field value has been set to `null`.",
            getResolverName(typename, fieldName)
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
          getResolverName(typename, fieldName)
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
          getResolverName(typename, fieldName)
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
      this.addError(toErrorLike(e), path, execContext);

      return null;
    }
  }

  private addError(error: ErrorLike, path: Path, execContext: ExecContext) {
    execContext.errors.push(
      addApolloExtension(
        isGraphQLError(error) ?
          { ...error.toJSON(), path }
        : { message: error.message, path }
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
  private collectDefinitionInfo(
    mainDefinition: OperationDefinitionNode,
    fragmentMap: FragmentMap
  ) {
    const isSingleASTNode = (
      node: ASTNode | readonly ASTNode[]
    ): node is ASTNode => !Array.isArray(node);

    const hasExportDirective = (parentNode: ASTNode | readonly ASTNode[]) => {
      return (
        Array.isArray(parentNode) &&
        parentNode.some(
          (node) => node.kind === Kind.DIRECTIVE && node.name.value === "export"
        )
      );
    };
    const selectionsToResolveCache = this.selectionsToResolveCache;
    const definitionsWithExportsCache = this.definitionsWithExportsCache;

    function collectByDefinition(
      definitionNode: ExecutableDefinitionNode
    ): Set<SelectionNode> {
      if (!selectionsToResolveCache.has(definitionNode)) {
        const matches = new Set<SelectionNode>();
        selectionsToResolveCache.set(definitionNode, matches);

        visit(definitionNode, {
          Directive(node: DirectiveNode, _, parent, ___, ancestors) {
            if (node.name.value === "client") {
              ancestors.forEach((node) => {
                if (isSingleASTNode(node) && isSelectionNode(node)) {
                  matches.add(node);
                }
              });

              if (
                parent &&
                definitionNode.kind === Kind.OPERATION_DEFINITION &&
                !definitionsWithExportsCache.has(definitionNode) &&
                hasExportDirective(parent)
              ) {
                definitionsWithExportsCache.add(definitionNode);
              }
            }
          },
          FragmentSpread(spread: FragmentSpreadNode, _, __, ___, ancestors) {
            const fragment = fragmentMap[spread.name.value];
            invariant(fragment, `No fragment named %s`, spread.name.value);

            const fragmentSelections = collectByDefinition(fragment);
            if (fragmentSelections.size > 0) {
              // Fragment for this spread contains @client directive (either directly or transitively)
              // Collect selection nodes on paths from the root down to fields with the @client directive
              ancestors.forEach((node) => {
                if (isSingleASTNode(node) && isSelectionNode(node)) {
                  matches.add(node);
                }
              });
              matches.add(spread);
              fragmentSelections.forEach((selection) => {
                matches.add(selection);
              });
            }
          },
        });
      }
      return selectionsToResolveCache.get(definitionNode)!;
    }
    return collectByDefinition(mainDefinition);
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

function addApolloExtension(error: GraphQLFormattedError) {
  return {
    ...error,
    extensions: {
      ...error.extensions,
      apollo: { source: "LocalResolversLink" },
    },
  };
}

function getRootTypename({ operation }: OperationDefinitionNode) {
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
