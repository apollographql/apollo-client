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
import { isSelectionNode, visit } from "graphql";
import { wrap } from "optimism";
import type { Observable } from "rxjs";
import { from, mergeMap, of } from "rxjs";

import type {
  DefaultContext,
  FragmentMatcher,
  OperationVariables,
} from "@apollo/client";
import { cacheSlot } from "@apollo/client/cache";
import type {
  ApolloContext,
  FetchResult,
  NextLink,
  Operation,
} from "@apollo/client/link/core";
import { ApolloLink } from "@apollo/client/link/core";
import type { FragmentMap, Merge } from "@apollo/client/utilities";
import {
  argumentsObjectFromField,
  cacheSizes,
  createFragmentMap,
  getFragmentDefinitions,
  getMainDefinition,
  hasDirectives,
  isField,
  isInlineFragment,
  mergeDeep,
  mergeDeepArray,
  removeDirectivesFromDocument,
  resultKeyNameFromField,
  shouldInclude,
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
    context: Merge<DefaultContext, ApolloContext>,
    info: {
      field: FieldNode;
      fragmentMap: FragmentMap;
    }
  ) => any;
}

type ExecContext = {
  operation: Operation;
  fragmentMap: FragmentMap;
  context: any;
  variables: OperationVariables;
  fragmentMatcher: FragmentMatcher;
  defaultOperationType: string;
  selectionsToResolve: Set<SelectionNode>;
};

export class LocalResolversLink extends ApolloLink {
  private selectionsToResolveCache = new WeakMap<
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

    let remote: Observable<FetchResult> = of({ data: null });

    if (serverQuery) {
      invariant(
        !!forward,
        "`LocalResolversLink` must not be a terminating link when there are non-`@client` fields in the query"
      );

      operation.query = serverQuery;
      remote = forward(operation);
    }

    return remote.pipe(
      mergeMap((result) => {
        return from(
          this.runResolvers({
            operation,
            clientQuery,
            remoteResult: result,
          })
        );
      })
    );
  }

  private async runResolvers({
    operation,
    clientQuery,
    remoteResult,
  }: {
    operation: Operation;
    clientQuery: DocumentNode | null;
    remoteResult: FetchResult;
  }): Promise<FetchResult> {
    if (!clientQuery) {
      return remoteResult;
    }

    const { variables } = operation;
    const context = operation.getContext();
    const mainDefinition = getMainDefinition(
      clientQuery
    ) as OperationDefinitionNode;
    const fragments = getFragmentDefinitions(clientQuery);
    const fragmentMap = createFragmentMap(fragments);
    const selectionsToResolve = this.collectSelectionsToResolve(
      mainDefinition,
      fragmentMap
    );

    const definitionOperation = mainDefinition.operation;

    const defaultOperationType =
      definitionOperation.charAt(0).toUpperCase() +
      definitionOperation.slice(1);

    const localResult = await this.resolveSelectionSet(
      mainDefinition.selectionSet,
      false,
      remoteResult.data ?? {},
      {
        operation,
        fragmentMap,
        context,
        variables,
        fragmentMatcher: () => true,
        defaultOperationType,
        selectionsToResolve,
      }
    );

    return { ...remoteResult, data: mergeDeep(remoteResult.data, localResult) };
  }

  private async resolveSelectionSet(
    selectionSet: SelectionSetNode,
    isClientFieldDescendant: boolean,
    rootValue: Record<string, any> | null | undefined,
    execContext: ExecContext
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

      if (isField(selection)) {
        const fieldResult = await this.resolveField(
          selection,
          isClientFieldDescendant,
          rootValue,
          execContext,
          selectionSet
        );

        if (fieldResult !== undefined) {
          resultsToMerge.push({
            [resultKeyNameFromField(selection)]: fieldResult,
          });
        }

        return;
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
          const fragmentResult = await this.resolveSelectionSet(
            fragment.selectionSet,
            isClientFieldDescendant,
            rootValue,
            execContext
          );

          resultsToMerge.push(fragmentResult);

          return;
        }
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
    parentSelectionSet: SelectionSetNode
  ): Promise<any> {
    if (!rootValue) {
      return null;
    }

    const { operation, variables } = execContext;
    const { cache } = operation.getApolloContext();
    const fieldName = field.name.value;
    const aliasedFieldName = resultKeyNameFromField(field);
    const aliasUsed = fieldName !== aliasedFieldName;
    let defaultResult = rootValue[fieldName];
    if (defaultResult === undefined) {
      defaultResult = rootValue[aliasedFieldName];
    }
    let resultPromise = Promise.resolve(defaultResult);

    const resolverType =
      rootValue.__typename || execContext.defaultOperationType;
    const resolverMap = this.resolvers?.[resolverType];
    if (resolverMap) {
      const resolver = resolverMap[aliasUsed ? fieldName : aliasedFieldName];
      if (resolver) {
        resultPromise = Promise.resolve(
          // In case the resolve function accesses reactive variables,
          // set cacheSlot to the current cache instance.
          cacheSlot.withValue(cache, resolver, [
            // Ensure the parent value passed to the resolver does not contain
            // aliased fields, otherwise it is nearly impossible to determine
            // what property in the parent type contains the field you want to
            // read from. `dealias` contains a shallow copy of `rootValue`
            dealias(parentSelectionSet, rootValue),
            argumentsObjectFromField(field, variables),
            { ...execContext.context, ...operation.getApolloContext() },
            { field, fragmentMap: execContext.fragmentMap },
          ])
        );
      }
    }

    let result = await resultPromise;

    if (result === undefined) {
      result = defaultResult;
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

// Note: this is only a shallow dealias function. We might consider a future
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
