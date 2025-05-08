import type {
  ASTNode,
  DirectiveNode,
  DocumentNode,
  ExecutableDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from "graphql";
import { isSelectionNode, Kind, visit } from "graphql";

import type {
  ApolloClient,
  DefaultContext,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { cacheSlot } from "@apollo/client/cache";
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
import { hasForcedResolvers } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

type ExecContext = {
  client: ApolloClient;
  fragmentMap: FragmentMap;
  context: DefaultContext;
  variables: OperationVariables;
  defaultOperationType: string;
  exportedVariables: OperationVariables;
  onlyRunForcedResolvers: boolean;
  selectionsToResolve: Set<SelectionNode>;
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
    remoteResult?: FetchResult<any>;
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

    const localResult = await this.resolveSelectionSet(
      mainDefinition.selectionSet,
      false,
      remoteResult ? remoteResult.data : {},
      {
        client,
        fragmentMap,
        context,
        variables,
        defaultOperationType,
        exportedVariables: {},
        selectionsToResolve,
        onlyRunForcedResolvers: false,
      }
    );

    return { ...remoteResult, data: localResult };
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
      fragmentMap,
      context,
      variables,
      defaultOperationType,
      exportedVariables: {},
      selectionsToResolve,
      onlyRunForcedResolvers: false,
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
      execContext
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
    execContext: ExecContext
  ) {
    const { fragmentMap, context, variables } = execContext;
    const resultsToMerge: TData[] = [rootValue];

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
            await this.resolveField(
              selection,
              isClientFieldDescendant,
              rootValue,
              execContext
            )
          : await this.resolveServerField(
              selection,
              rootValue as any,
              execContext
            );

        if (typeof fieldResult !== "undefined") {
          resultsToMerge.push({
            [resultKeyNameFromField(selection)]: fieldResult,
          } as TData);
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

      if (fragment && fragment.typeCondition) {
        const typeCondition = fragment.typeCondition.name.value;
        if (execContext.fragmentMatcher(rootValue, typeCondition, context)) {
          const fragmentResult = await this.resolveSelectionSet(
            fragment.selectionSet,
            isClientFieldDescendant,
            rootValue,
            execContext
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
    execContext: ExecContext
  ) {
    const result = rootValue?.[field.name.value];

    if (result === null) {
      return result;
    }

    if (!field.selectionSet) {
      return result;
    }

    if (Array.isArray(result)) {
      return this.resolveSubSelectedArray(field, false, result, execContext);
    }

    return this.resolveSelectionSet(
      field.selectionSet,
      false,
      result,
      execContext
    );
  }

  private async resolveField(
    field: FieldNode,
    isClientFieldDescendant: boolean,
    rootValue: any,
    execContext: ExecContext
  ): Promise<any> {
    if (!rootValue) {
      return null;
    }

    const { client, variables } = execContext;
    const fieldName = field.name.value;
    const aliasedFieldName = resultKeyNameFromField(field);
    const aliasUsed = fieldName !== aliasedFieldName;
    const defaultResult = rootValue[aliasedFieldName] || rootValue[fieldName];
    let resultPromise = Promise.resolve(defaultResult);

    // Usually all local resolvers are run when passing through here, but
    // if we've specifically identified that we only want to run forced
    // resolvers (that is, resolvers for fields marked with
    // `@client(always: true)`), then we'll skip running non-forced resolvers.
    if (!execContext.onlyRunForcedResolvers || hasForcedResolvers(field)) {
      const resolverType =
        rootValue.__typename || execContext.defaultOperationType;
      const resolverMap = this.resolvers && this.resolvers[resolverType];
      if (resolverMap) {
        const resolve = resolverMap[aliasUsed ? fieldName : aliasedFieldName];
        if (resolve) {
          resultPromise = Promise.resolve(
            // In case the resolve function accesses reactive variables,
            // set cacheSlot to the current cache instance.
            cacheSlot.withValue(client.cache, resolve, [
              rootValue,
              argumentsObjectFromField(field, variables),
              { ...execContext.context, client },
              { field, fragmentMap: execContext.fragmentMap },
            ])
          );
        }
      }
    }

    return resultPromise.then((result = defaultResult) => {
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

      const isClientField =
        field.directives?.some((d) => d.name.value === "client") ?? false;

      if (Array.isArray(result)) {
        return this.resolveSubSelectedArray(
          field,
          isClientFieldDescendant || isClientField,
          result,
          execContext
        );
      }

      // Returned value is an object, and the query has a sub-selection. Recurse.
      if (field.selectionSet) {
        return this.resolveSelectionSet(
          field.selectionSet,
          isClientFieldDescendant || isClientField,
          result,
          execContext
        );
      }
    });
  }

  private resolveSubSelectedArray(
    field: FieldNode,
    isClientFieldDescendant: boolean,
    result: any[],
    execContext: ExecContext
  ): any {
    return Promise.all(
      result.map((item) => {
        if (item === null) {
          return null;
        }

        // This is a nested array, recurse.
        if (Array.isArray(item)) {
          return this.resolveSubSelectedArray(
            field,
            isClientFieldDescendant,
            item,
            execContext
          );
        }

        // This is an object, run the selection set on it.
        if (field.selectionSet) {
          return this.resolveSelectionSet(
            field.selectionSet,
            isClientFieldDescendant,
            item,
            execContext
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
