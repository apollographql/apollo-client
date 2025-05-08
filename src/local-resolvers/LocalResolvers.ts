import type {
  ASTNode,
  DirectiveNode,
  DocumentNode,
  ExecutableDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  GraphQLError,
  GraphQLFormattedError,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from "graphql";
import { isSelectionNode, Kind, visit } from "graphql";

import type {
  ApolloClient,
  DefaultContext,
  ErrorLike,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { cacheSlot } from "@apollo/client/cache";
import { toErrorLike } from "@apollo/client/errors";
import type { FetchResult } from "@apollo/client/link";
import type { FragmentMap, NoInfer } from "@apollo/client/utilities";
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
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

type ExecContext = {
  client: ApolloClient;
  operationDefinition: OperationDefinitionNode;
  fragmentMap: FragmentMap;
  context: DefaultContext;
  variables: OperationVariables;
  defaultOperationType: string;
  exportedVariables: OperationVariables;
  onlyRunForcedResolvers: boolean;
  selectionsToResolve: Set<SelectionNode>;
  errors: GraphQLFormattedError[];
};

export declare namespace LocalResolvers {
  export interface Options<TResolvers extends Resolvers> {
    resolvers?: TResolvers;
  }

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
    context: DefaultContext & { client: ApolloClient },
    info: {
      field: FieldNode;
      fragmentMap: FragmentMap;
      path: Path;
    }
  ) => TResult;

  export type Path = Array<string | number>;
}

export class LocalResolvers<
  TResolvers extends LocalResolvers.Resolvers = LocalResolvers.Resolvers,
> {
  private resolvers: LocalResolvers.Resolvers = {};
  private selectionsToResolveCache = new WeakMap<
    ExecutableDefinitionNode,
    Set<SelectionNode>
  >();

  constructor(
    ...[options]: {} extends TResolvers ?
      [options?: LocalResolvers.Options<TResolvers>]
    : [options: LocalResolvers.Options<TResolvers> & { resolvers: TResolvers }]
  ) {
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
  }: {
    document: DocumentNode | TypedDocumentNode<TData, TVariables>;
    client: ApolloClient;
    context: DefaultContext;
    remoteResult?: FetchResult;
    variables?: TVariables;
  }): Promise<FetchResult<TData>> {
    if (__DEV__) {
      invariant(
        hasDirectives(["client"], document),
        "Expected document to contain `@client` fields."
      );
    }

    const mainDefinition = getMainDefinition(
      document
    ) as OperationDefinitionNode;
    const fragments = getFragmentDefinitions(document);
    const fragmentMap = createFragmentMap(fragments);
    const selectionsToResolve = this.collectSelectionsToResolve(
      mainDefinition,
      fragmentMap
    );

    const definitionOperation = mainDefinition.operation;

    const defaultOperationType =
      definitionOperation ?
        definitionOperation.charAt(0).toUpperCase() +
        definitionOperation.slice(1)
      : "Query";

    const rootValue = remoteResult ? remoteResult.data : {};

    const execContext: ExecContext = {
      client,
      operationDefinition: mainDefinition,
      fragmentMap,
      context,
      variables,
      defaultOperationType,
      exportedVariables: {},
      selectionsToResolve,
      onlyRunForcedResolvers: false,
      errors: [],
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
    const mainDefinition = getMainDefinition(
      document
    ) as OperationDefinitionNode;
    const fragments = getFragmentDefinitions(document);
    const fragmentMap = createFragmentMap(fragments);
    const selectionsToResolve = this.collectSelectionsToResolve(
      mainDefinition,
      fragmentMap
    );

    const definitionOperation = mainDefinition.operation;

    const defaultOperationType =
      definitionOperation ?
        definitionOperation.charAt(0).toUpperCase() +
        definitionOperation.slice(1)
      : "Query";

    const execContext: ExecContext = {
      client,
      operationDefinition: mainDefinition,
      fragmentMap,
      context,
      variables,
      defaultOperationType,
      exportedVariables: {},
      selectionsToResolve,
      onlyRunForcedResolvers: false,
      errors: [],
    };

    await this.resolveSelectionSet(
      mainDefinition.selectionSet,
      false,
      client.cache.diff({
        query: buildQueryFromSelectionSet(document),
        variables,
        returnPartialData: true,
        optimistic: false,
      }).result,
      execContext,
      []
    );

    return {
      ...variables,
      ...execContext.exportedVariables,
    } as TVariables;
  }

  private async resolveSelectionSet<TData>(
    selectionSet: SelectionSetNode,
    isClientFieldDescendant: boolean,
    rootValue: TData,
    execContext: ExecContext,
    path: LocalResolvers.Path
  ) {
    const { fragmentMap, context, variables } = execContext;
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
              path.concat(selection.name.value)
            )
          : await this.resolveServerField(
              selection,
              rootValue as any,
              execContext,
              path.concat(selection.name.value)
            );

        if (typeof fieldResult !== "undefined") {
          resultsToMerge.push({
            [resultKeyNameFromField(selection)]: fieldResult,
          });
        }

        return;
      }

      let fragment: InlineFragmentNode | FragmentDefinitionNode;

      if (selection.kind === Kind.INLINE_FRAGMENT) {
        fragment = selection;
      } else {
        // This is a named fragment.
        fragment = fragmentMap[selection.name.value];
        invariant(fragment, `No fragment named %s`, selection.name.value);
      }

      // TODO: Update to use cache.fragmentMatches
      const fragmentMatcher = (_: any, __: any, ___: any) => true;

      if (fragment && fragment.typeCondition) {
        const typeCondition = fragment.typeCondition.name.value;
        if (fragmentMatcher(rootValue, typeCondition, context)) {
          const fragmentResult = await this.resolveSelectionSet(
            fragment.selectionSet,
            isClientFieldDescendant,
            rootValue,
            execContext,
            path
          );

          resultsToMerge.push(fragmentResult);
        }
      }
    };

    await Promise.all(selectionSet.selections.map(execute));

    return mergeDeepArray(resultsToMerge);
  }

  private resolveServerField(
    field: FieldNode,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: LocalResolvers.Path
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

  private async resolveClientField(
    field: FieldNode,
    isClientFieldDescendant: boolean,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext,
    path: LocalResolvers.Path
  ): Promise<any> {
    if (!rootValue) {
      return null;
    }

    const { client, variables } = execContext;
    const fieldName = field.name.value;
    const typename = rootValue?.__typename || execContext.defaultOperationType;
    const resolverName = `${typename}.${fieldName}`;

    const defaultResolver =
      isClientFieldDescendant ?
        () => rootValue?.[fieldName]
        // We expect a resolver to be defined for all `@client` root fields.
        // Warn if a resolver is not defined.
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
            // In case the resolve function accesses reactive variables,
            // set cacheSlot to the current cache instance.
            cacheSlot.withValue(client.cache, resolver, [
              rootValue,
              (argumentsObjectFromField(field, variables) ?? {}) as Record<
                string,
                unknown
              >,
              { ...execContext.context, client },
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

    if (result === undefined) {
      if (__DEV__) {
        invariant.warn(
          resolver ?
            "The '%s' resolver returned `undefined` instead of a value. This is likely a bug in the resolver. If you didn't mean to return a value, return `null` instead."
          : "The '%s' field returned `undefined` instead of a value. The parent resolver forgot to include the property in the returned value and there was no resolver defined for the field.",
          resolverName
        );
      }

      result = null;
    }

    // If an @export directive is associated with the current field, store
    // the `as` export variable name and current result for later use.
    if (field.directives) {
      field.directives.forEach((directive) => {
        if (directive.name.value === "export" && directive.arguments) {
          directive.arguments.forEach((arg) => {
            if (arg.name.value === "as" && arg.value.kind === "StringValue") {
              execContext.exportedVariables[arg.value.value] = result;
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
        true,
        result,
        execContext,
        path
      );
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
  private collectSelectionsToResolve(
    mainDefinition: OperationDefinitionNode,
    fragmentMap: FragmentMap
  ): Set<SelectionNode> {
    const isSingleASTNode = (
      node: ASTNode | readonly ASTNode[]
    ): node is ASTNode => !Array.isArray(node);
    const selectionsToResolveCache = this.selectionsToResolveCache;

    function collectByDefinition(
      definitionNode: ExecutableDefinitionNode
    ): Set<SelectionNode> {
      if (!selectionsToResolveCache.has(definitionNode)) {
        const matches = new Set<SelectionNode>();
        selectionsToResolveCache.set(definitionNode, matches);

        visit(definitionNode, {
          Directive(node: DirectiveNode, _, __, ___, ancestors) {
            if (node.name.value === "client") {
              ancestors.forEach((node) => {
                if (isSingleASTNode(node) && isSelectionNode(node)) {
                  matches.add(node);
                }
              });
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
      apollo: { source: "LocalResolvers", ...meta },
    },
  };
}
