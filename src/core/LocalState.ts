import { invariant } from "../utilities/globals/index.js";

import type {
  DocumentNode,
  OperationDefinitionNode,
  SelectionSetNode,
  SelectionNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  FieldNode,
  ASTNode,
  DirectiveNode,
  FragmentSpreadNode,
  ExecutableDefinitionNode,
} from "graphql";
import { visit, BREAK, isSelectionNode } from "graphql";

import type { ApolloCache } from "../cache/index.js";
import type { FragmentMap, StoreObject } from "../utilities/index.js";
import {
  argumentsObjectFromField,
  buildQueryFromSelectionSet,
  createFragmentMap,
  getFragmentDefinitions,
  getMainDefinition,
  hasDirectives,
  isField,
  isInlineFragment,
  mergeDeep,
  mergeDeepArray,
  removeClientSetsFromDocument,
  resultKeyNameFromField,
  shouldInclude,
} from "../utilities/index.js";
import type { ApolloClient } from "./ApolloClient.js";
import type { Resolvers, OperationVariables } from "./types.js";
import type { FetchResult } from "../link/core/index.js";
import { cacheSlot } from "../cache/index.js";

export type Resolver = (
  rootValue?: any,
  args?: any,
  context?: any,
  info?: {
    field: FieldNode;
    fragmentMap: FragmentMap;
  }
) => any;

export type VariableMap = { [name: string]: any };

export type FragmentMatcher = (
  rootValue: any,
  typeCondition: string,
  context: any
) => boolean;

export type ExecContext = {
  fragmentMap: FragmentMap;
  context: any;
  variables: VariableMap;
  fragmentMatcher: FragmentMatcher;
  defaultOperationType: string;
  exportedVariables: Record<string, any>;
  onlyRunForcedResolvers: boolean;
  selectionsToResolve: Set<SelectionNode>;
};

export type LocalStateOptions<TCacheShape> = {
  cache: ApolloCache<TCacheShape>;
  client?: ApolloClient<TCacheShape>;
  resolvers?: Resolvers | Resolvers[];
  fragmentMatcher?: FragmentMatcher;
};

export class LocalState<TCacheShape> {
  private cache: ApolloCache<TCacheShape>;
  private client?: ApolloClient<TCacheShape>;
  private resolvers?: Resolvers;
  private fragmentMatcher?: FragmentMatcher;
  private selectionsToResolveCache = new WeakMap<
    ExecutableDefinitionNode,
    Set<SelectionNode>
  >();

  constructor({
    cache,
    client,
    resolvers,
    fragmentMatcher,
  }: LocalStateOptions<TCacheShape>) {
    this.cache = cache;

    if (client) {
      this.client = client;
    }

    if (resolvers) {
      this.addResolvers(resolvers);
    }

    if (fragmentMatcher) {
      this.setFragmentMatcher(fragmentMatcher);
    }
  }

  public addResolvers(resolvers: Resolvers | Resolvers[]) {
    this.resolvers = this.resolvers || {};
    if (Array.isArray(resolvers)) {
      resolvers.forEach((resolverGroup) => {
        this.resolvers = mergeDeep(this.resolvers, resolverGroup);
      });
    } else {
      this.resolvers = mergeDeep(this.resolvers, resolvers);
    }
  }

  public setResolvers(resolvers: Resolvers | Resolvers[]) {
    this.resolvers = {};
    this.addResolvers(resolvers);
  }

  public getResolvers() {
    return this.resolvers || {};
  }

  // Run local client resolvers against the incoming query and remote data.
  // Locally resolved field values are merged with the incoming remote data,
  // and returned. Note that locally resolved fields will overwrite
  // remote data using the same field name.
  public async runResolvers<TData>({
    document,
    remoteResult,
    context,
    variables,
    onlyRunForcedResolvers = false,
  }: {
    document: DocumentNode | null;
    remoteResult: FetchResult<TData>;
    context?: Record<string, any>;
    variables?: Record<string, any>;
    onlyRunForcedResolvers?: boolean;
  }): Promise<FetchResult<TData>> {
    if (document) {
      return this.resolveDocument(
        document,
        remoteResult.data,
        context,
        variables,
        this.fragmentMatcher,
        onlyRunForcedResolvers
      ).then((localResult) => ({
        ...remoteResult,
        data: localResult.result,
      }));
    }

    return remoteResult;
  }

  public setFragmentMatcher(fragmentMatcher: FragmentMatcher) {
    this.fragmentMatcher = fragmentMatcher;
  }

  public getFragmentMatcher(): FragmentMatcher | undefined {
    return this.fragmentMatcher;
  }

  // Client queries contain everything in the incoming document (if a @client
  // directive is found).
  public clientQuery(document: DocumentNode) {
    if (hasDirectives(["client"], document)) {
      if (this.resolvers) {
        return document;
      }
    }
    return null;
  }

  // Server queries are stripped of all @client based selection sets.
  public serverQuery(document: DocumentNode) {
    return removeClientSetsFromDocument(document);
  }

  public prepareContext(context?: Record<string, any>) {
    const { cache } = this;
    return {
      ...context,
      cache,
      // Getting an entry's cache key is useful for local state resolvers.
      getCacheKey(obj: StoreObject) {
        return cache.identify(obj);
      },
    };
  }

  // To support `@client @export(as: "someVar")` syntax, we'll first resolve
  // @client @export fields locally, then pass the resolved values back to be
  // used alongside the original operation variables.
  public async addExportedVariables<TVars extends OperationVariables>(
    document: DocumentNode,
    variables: TVars = {} as TVars,
    context = {}
  ): /* returns at least the variables that were passed in */ Promise<TVars> {
    if (document) {
      return this.resolveDocument(
        document,
        this.buildRootValueFromCache(document, variables) || {},
        this.prepareContext(context),
        variables
      ).then((data) => ({
        ...variables,
        ...data.exportedVariables,
      }));
    }

    return {
      ...variables,
    };
  }

  public shouldForceResolvers(document: ASTNode) {
    let forceResolvers = false;
    visit(document, {
      Directive: {
        enter(node) {
          if (node.name.value === "client" && node.arguments) {
            forceResolvers = node.arguments.some(
              (arg) =>
                arg.name.value === "always" &&
                arg.value.kind === "BooleanValue" &&
                arg.value.value === true
            );
            if (forceResolvers) {
              return BREAK;
            }
          }
        },
      },
    });
    return forceResolvers;
  }

  // Query the cache and return matching data.
  private buildRootValueFromCache(
    document: DocumentNode,
    variables?: Record<string, any>
  ) {
    return this.cache.diff({
      query: buildQueryFromSelectionSet(document),
      variables,
      returnPartialData: true,
      optimistic: false,
    }).result;
  }

  private async resolveDocument<TData>(
    document: DocumentNode,
    rootValue: TData,
    context: any = {},
    variables: VariableMap = {},
    fragmentMatcher: FragmentMatcher = () => true,
    onlyRunForcedResolvers: boolean = false
  ) {
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

    const { cache, client } = this;
    const execContext: ExecContext = {
      fragmentMap,
      context: {
        ...context,
        cache,
        client,
      },
      variables,
      fragmentMatcher,
      defaultOperationType,
      exportedVariables: {},
      selectionsToResolve,
      onlyRunForcedResolvers,
    };
    const isClientFieldDescendant = false;

    return this.resolveSelectionSet(
      mainDefinition.selectionSet,
      isClientFieldDescendant,
      rootValue,
      execContext
    ).then((result) => ({
      result,
      exportedVariables: execContext.exportedVariables,
    }));
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

      if (isField(selection)) {
        return this.resolveField(
          selection,
          isClientFieldDescendant,
          rootValue,
          execContext
        ).then((fieldResult) => {
          if (typeof fieldResult !== "undefined") {
            resultsToMerge.push({
              [resultKeyNameFromField(selection)]: fieldResult,
            } as TData);
          }
        });
      }

      let fragment: InlineFragmentNode | FragmentDefinitionNode;

      if (isInlineFragment(selection)) {
        fragment = selection;
      } else {
        // This is a named fragment.
        fragment = fragmentMap[selection.name.value];
        invariant(fragment, `No fragment named %s`, selection.name.value);
      }

      if (fragment && fragment.typeCondition) {
        const typeCondition = fragment.typeCondition.name.value;
        if (execContext.fragmentMatcher(rootValue, typeCondition, context)) {
          return this.resolveSelectionSet(
            fragment.selectionSet,
            isClientFieldDescendant,
            rootValue,
            execContext
          ).then((fragmentResult) => {
            resultsToMerge.push(fragmentResult);
          });
        }
      }
    };

    return Promise.all(selectionSet.selections.map(execute)).then(function () {
      return mergeDeepArray(resultsToMerge);
    });
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

    const { variables } = execContext;
    const fieldName = field.name.value;
    const aliasedFieldName = resultKeyNameFromField(field);
    const aliasUsed = fieldName !== aliasedFieldName;
    const defaultResult = rootValue[aliasedFieldName] || rootValue[fieldName];
    let resultPromise = Promise.resolve(defaultResult);

    // Usually all local resolvers are run when passing through here, but
    // if we've specifically identified that we only want to run forced
    // resolvers (that is, resolvers for fields marked with
    // `@client(always: true)`), then we'll skip running non-forced resolvers.
    if (
      !execContext.onlyRunForcedResolvers ||
      this.shouldForceResolvers(field)
    ) {
      const resolverType =
        rootValue.__typename || execContext.defaultOperationType;
      const resolverMap = this.resolvers && this.resolvers[resolverType];
      if (resolverMap) {
        const resolve = resolverMap[aliasUsed ? fieldName : aliasedFieldName];
        if (resolve) {
          resultPromise = Promise.resolve(
            // In case the resolve function accesses reactive variables,
            // set cacheSlot to the current cache instance.
            cacheSlot.withValue(this.cache, resolve, [
              rootValue,
              argumentsObjectFromField(field, variables),
              execContext.context,
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
