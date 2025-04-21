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
import { BREAK, isSelectionNode, visit } from "graphql";
import { wrap } from "optimism";
import type { Observable } from "rxjs";
import { from, mergeMap, of } from "rxjs";

import type {
  ApolloCache,
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
    resolvers: Resolvers;
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
  cache: ApolloCache;
  fragmentMap: FragmentMap;
  context: any;
  variables: OperationVariables;
  fragmentMatcher: FragmentMatcher;
  defaultOperationType: string;
  exportedVariables: Record<string, any>;
  onlyRunForcedResolvers: boolean;
  selectionsToResolve: Set<SelectionNode>;
};

export class LocalResolversLink extends ApolloLink {
  private selectionsToResolveCache = new WeakMap<
    ExecutableDefinitionNode,
    Set<SelectionNode>
  >();
  private resolvers!: LocalResolversLink.Resolvers;

  constructor(options: LocalResolversLink.Options) {
    super();
    this.addResolvers(options.resolvers);
  }

  addResolvers(resolvers: LocalResolversLink.Resolvers) {
    this.resolvers = this.resolvers || {};
    if (Array.isArray(resolvers)) {
      resolvers.forEach((resolverGroup) => {
        this.resolvers = mergeDeep(this.resolvers, resolverGroup);
      });
    } else {
      this.resolvers = mergeDeep(this.resolvers, resolvers);
    }
  }

  override request(
    operation: Operation,
    forward?: NextLink
  ): Observable<FetchResult> {
    const { clientQuery, serverQuery } = getTransformedQuery(operation.query);

    let remoteObservable: Observable<FetchResult> = of({ data: {} });

    if (serverQuery) {
      invariant(
        !!forward,
        "`LocalResolversLink` must not be a terminating link when there are non-`@client` fields in the query"
      );

      operation.query = serverQuery;
      remoteObservable = forward(operation);
    }

    return remoteObservable.pipe(
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
    if (clientQuery) {
      return this.resolveDocument(
        operation,
        clientQuery,
        remoteResult.data
      ).then((localResult) => ({
        ...remoteResult,
        data: localResult.result,
      }));
    }

    return remoteResult;
  }

  private async resolveDocument(
    operation: Operation,
    document: DocumentNode,
    rootValue: Record<string, any> | null | undefined,
    fragmentMatcher: FragmentMatcher = () => true,
    onlyRunForcedResolvers: boolean = false
  ) {
    const { variables } = operation;
    const { cache } = operation.getApolloContext();
    const context = operation.getContext();
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
      cache,
      fragmentMap,
      context: { ...context, ...operation.getApolloContext() },
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

    const { cache, variables } = execContext;
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
            cacheSlot.withValue(cache, resolve, [
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
