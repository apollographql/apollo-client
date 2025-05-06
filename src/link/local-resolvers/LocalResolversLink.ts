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

import type { ErrorLike } from "@apollo/client";
import { cacheSlot } from "@apollo/client/cache";
import { LocalResolversError, toErrorLike } from "@apollo/client/errors";
import type { FetchResult, NextLink, Operation } from "@apollo/client/link";
import { ApolloLink } from "@apollo/client/link";
import type { FragmentMap, IsAny, NoInfer } from "@apollo/client/utilities";
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
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

import { defaultCacheSizes } from "../../utilities/caching/sizes.js";

type MaybeRequireRootValue<TRootValue> =
  true extends IsAny<TRootValue> ? {}
  : undefined extends TRootValue ? {}
  : unknown extends TRootValue ? {}
  : {
      rootValue:
        | TRootValue
        | ((options: { operation: Operation }) => TRootValue);
    };

export declare namespace LocalResolversLink {
  // `rootValue` can be any value, but using `any` or `unknown` does not allow
  // the ability to add a function signature to this definition. The generic
  // allows us to provide the function signature while allowing any value.
  export type Options<
    TResolvers = LocalResolversLink.Resolvers,
    TRootValue = unknown,
  > = {
    /**
     * A value or function called with the current `operation` creating the root
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
    rootValue?:
      | TRootValue
      | ((options: { operation: Operation }) => TRootValue);

    /**
     * The map of resolvers used to provide values for `@local` fields.
     */
    resolvers?: TResolvers;
  } & MaybeRequireRootValue<TRootValue>;

  export interface Resolvers {
    [typename: string]: {
      [field: string]: Resolver<any, any, any>;
    };
  }

  export interface ResolveInfo {
    field: FieldNode;
    fragmentMap: FragmentMap;
    path: Path;
  }

  export type Resolver<
    TResult = unknown,
    TParent = unknown,
    TArgs = Record<string, unknown>,
  > = (
    parent: TParent,
    args: TArgs,
    context: ResolverContext,
    info: ResolveInfo
  ) => TResult;

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
  rootValue?: any;
};

type Path = Array<string | number>;

interface TraverseCacheEntry {
  selectionsToResolve: Set<SelectionNode>;
}

type InferRootValueFromFieldResolver<TField> =
  TField extends { [key: string]: infer TResolver } ?
    TResolver extends LocalResolversLink.Resolver<any, infer TRootValue, any> ?
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

export class LocalResolversLink<
  TResolvers extends
    LocalResolversLink.Resolvers = LocalResolversLink.Resolvers,
  TRootValue = InferRootValueFromResolvers<TResolvers>,
> extends ApolloLink {
  private traverseCache = new WeakMap<
    ExecutableDefinitionNode,
    TraverseCacheEntry
  >();
  private resolvers: LocalResolversLink.Resolvers = {};
  private rootValue?: LocalResolversLink.Options["rootValue"];

  constructor(
    ...[options]: {} extends TResolvers ?
      [options?: LocalResolversLink.Options<TResolvers, NoInfer<TRootValue>>]
    : [
        options: LocalResolversLink.Options<TResolvers, NoInfer<TRootValue>> & {
          resolvers: TResolvers;
        },
      ]
  ) {
    super();

    this.rootValue = options?.rootValue;
    if (options?.resolvers) {
      this.addResolvers(options.resolvers as LocalResolversLink.Resolvers);
    }
  }

  addResolvers(resolvers: LocalResolversLink.Resolvers) {
    this.resolvers = mergeDeep(this.resolvers, resolvers);
  }

  override request(
    operation: Operation,
    forward?: NextLink
  ): Observable<FetchResult> {
    const { localQuery, serverQuery } = getTransformedQuery(operation.query);

    if (!localQuery) {
      return getServerResult();
    }

    if (__DEV__) {
      if (!operation.client.cache.fragmentMatches) {
        warnOnImproperCacheImplementation();
      }
    }

    function getServerResult() {
      if (!serverQuery) {
        // If we don't have a server query, then we have a client-only query.
        // Intentionally use `{}` here as the value to ensure that client-only
        // fields are merged into the final result. If this were `null`, then
        // the client fields would add errors to the error array and return
        // `data` of `null`.
        return of({ data: {} } as FetchResult);
      }

      invariant(
        !!forward,
        "`LocalResolversLink` must not be a terminating link when there are non-`@local` fields in the query"
      );

      operation.query = serverQuery;

      return forward(operation);
    }

    const operationDefinition = getMainDefinition(
      localQuery
    ) as OperationDefinitionNode;
    const fragments = getFragmentDefinitions(localQuery);
    const fragmentMap = createFragmentMap(fragments);

    const { selectionsToResolve } = this.traverseAndCollectQueryInfo(
      operationDefinition,
      fragmentMap
    );

    return getServerResult().pipe(
      mergeMap((result) => {
        return from(
          this.runResolvers({
            remoteResult: result,
            execContext: {
              operation,
              operationDefinition,
              fragmentMap,
              errors: [],
              selectionsToResolve,
              rootValue:
                typeof this.rootValue === "function" ?
                  this.rootValue({ operation })
                : this.rootValue,
            },
          })
        );
      })
    );
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
    isLocalFieldDescendant: boolean,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: Path
  ) {
    const { fragmentMap, operation, operationDefinition } = execContext;
    const { client, variables } = operation;
    const resultsToMerge: Array<Record<string, any>> = [];

    const execute = async (selection: SelectionNode): Promise<void> => {
      if (
        !isLocalFieldDescendant &&
        !execContext.selectionsToResolve.has(selection)
      ) {
        // Skip selections without @local directives
        // (still processing if one of the ancestors or one of the child fields has @client directive)
        return;
      }
      if (!shouldInclude(selection, variables)) {
        // Skip this entirely.
        return;
      }

      if (selection.kind === Kind.FIELD) {
        const isRootField = selectionSet === operationDefinition.selectionSet;
        const isLocalField =
          isLocalFieldDescendant ||
          (selection.directives?.some((d) => d.name.value === "local") ??
            false);

        const fieldResult =
          isLocalField ?
            await this.resolveLocalField(
              selection,
              isLocalFieldDescendant,
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
          client.cache.fragmentMatches?.(selection, rootValue.__typename)
        ) {
          const fragmentResult = await this.resolveSelectionSet(
            selection.selectionSet,
            isLocalFieldDescendant,
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

        const typename = rootValue?.__typename;
        const typeCondition = fragment.typeCondition.name.value;

        // Allow exact matches on typename even if the cache doesn't implement
        // the fragmentMatches API.
        let fragmentMatches = typename === typeCondition;

        if (!fragmentMatches && client.cache.fragmentMatches) {
          fragmentMatches = client.cache.fragmentMatches(
            fragment,
            typename ?? ""
          );
        }

        if (!fragmentMatches) {
          throw new LocalResolversError(
            `Fragment '${fragment.name.value}' cannot be used with type '${typename}' as objects of type '${typename}' can never be of type '${fragment.typeCondition.name.value}'.`,
            { path }
          );
        }

        const fragmentResult = await this.resolveSelectionSet(
          fragment.selectionSet,
          isLocalFieldDescendant,
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

  private async resolveServerField(
    field: FieldNode,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: Path
  ) {
    const result = rootValue?.[field.name.value];

    if (result == null) {
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

  private async resolveLocalField(
    field: FieldNode,
    isLocalFieldDescendant: boolean,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    parentSelectionSet: SelectionSetNode,
    path: Path
  ) {
    const { operation, operationDefinition } = execContext;
    const isRootField = parentSelectionSet === operationDefinition.selectionSet;

    const fieldName = field.name.value;
    const typename =
      isRootField ?
        rootValue?.__typename || inferRootTypename(operationDefinition)
      : rootValue?.__typename;
    const resolverName = getResolverName(typename, fieldName);

    invariant(
      typename,
      "Could not determine typename when resolving field '%s'. Ensure the parent resolver returns `__typename`.",
      fieldName
    );

    const defaultResolver =
      isLocalFieldDescendant ?
        () => rootValue?.[fieldName]
        // We expect a resolver to be defined for all `@local` root fields.
        // Warn when a resolver is not defined.
      : () => {
          if (__DEV__) {
            invariant.warn(
              "Could not find a resolver for the '%s' field. The field value has been set to `null`.",
              resolverName
            );
          }

          return null;
        };

    const resolver = this.getResolver(typename, fieldName);
    let result: unknown;

    try {
      result =
        resolver ?
          await Promise.resolve(
            cacheSlot.withValue(operation.client.cache, resolver, [
              isRootField ?
                execContext.rootValue
              : dealias(parentSelectionSet, rootValue) ?? {},
              (argumentsObjectFromField(field, operation.variables) ??
                {}) as Record<string, unknown>,
              { operation },
              { field, fragmentMap: execContext.fragmentMap, path },
            ])
          )
        : defaultResolver();
    } catch (e) {
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

    if (result === undefined) {
      // Its ok to return undefined for an exported variable if the variable is
      // optional. We don't want to warn in that case.
      if (__DEV__) {
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

    if (!(result as any).__typename) {
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

  private getResolver(
    typename: string,
    fieldName: string
  ): LocalResolversLink.Resolver | undefined {
    return this.resolvers[typename]?.[fieldName];
  }

  private addError(
    error: ErrorLike,
    path: Path,
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

  private resolveSubSelectedArray(
    field: FieldNode,
    isLocalFieldDescendant: boolean,
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
            isLocalFieldDescendant,
            item,
            execContext,
            path.concat(idx)
          );
        }

        // This is an object, run the selection set on it.
        if (field.selectionSet) {
          return this.resolveSelectionSet(
            field.selectionSet,
            isLocalFieldDescendant,
            item,
            execContext,
            path.concat(idx)
          );
        }
      })
    );
  }

  // Collect selection nodes on paths from document root down to all @local directives.
  // This function takes into account transitive fragment spreads.
  // Complexity equals to a single `visit` over the full document.
  private traverseAndCollectQueryInfo(
    mainDefinition: OperationDefinitionNode,
    fragmentMap: FragmentMap
  ) {
    const isSingleASTNode = (
      node: ASTNode | readonly ASTNode[]
    ): node is ASTNode => !Array.isArray(node);

    const traverse = (definitionNode: ExecutableDefinitionNode) => {
      if (this.traverseCache.has(definitionNode)) {
        return this.traverseCache.get(definitionNode)!;
      }

      const cache: TraverseCacheEntry = {
        selectionsToResolve: new Set<SelectionNode>(),
      };
      this.traverseCache.set(definitionNode, cache);

      visit(definitionNode, {
        Directive: (directive, _, __, ___, ancestors) => {
          if (directive.name.value === "local") {
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
            // Fragment for this spread contains @local directive (either directly or transitively)
            // Collect selection nodes on paths from the root down to fields with the @local directive
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
  fieldValue: Record<string, any> | null | undefined
) {
  if (!fieldValue) {
    return fieldValue;
  }

  const data = { ...fieldValue };

  for (const selection of selectionSet.selections) {
    if (isField(selection) && selection.alias) {
      data[selection.name.value] = fieldValue[selection.alias.value];
      delete data[selection.alias.value];
    }
  }

  return data;
}

const getTransformedQuery = wrap(
  (query: DocumentNode) => {
    return {
      localQuery: hasDirectives(["local"], query) ? query : null,
      serverQuery: removeDirectivesFromDocument(
        [{ name: "local", remove: true }],
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

let issuedWarning = false;
function warnOnImproperCacheImplementation() {
  if (!issuedWarning) {
    issuedWarning = true;
    invariant.warn(
      "The configured cache does not support fragment matching which may lead to incorrect results when executing local resolvers. Please use a cache matches fragments to silence this warning."
    );
  }
}
